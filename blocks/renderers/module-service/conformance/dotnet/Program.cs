// The .NET conformance host (backlog #549 — slice 3 of epic #507).
//
// Drives the @generated MaaS origin (#548 — GeneratedMaaSOrigin) against the language-neutral golden
// vectors (golden.json, #506) and emits each response in the runner's neutral ActualResponse shape, so
// the TypeScript ConformanceTarget (dotnetTarget.ts) can hold it to byte-identical / identity-stable
// fidelity — the exact same bar the JS reference target passes.
//
// What the host INJECTS (the seams the generated shell deliberately leaves open, exactly as the JS
// reference injects resolve/resolver — see GeneratedMaaSOrigin's constructor doc):
//   • resolveDefinition — the fixture's component → its authored <component> source.
//   • transform        — the fixture's frozen transform output (so the suite is DOM-free + deterministic).
//   • identity         — the #088 content-hash identity, reproduced BYTE-FOR-BYTE from the JS reference
//                        (sha256-<base64url> id over the canonical input JSON; sha256-<base64> SRI over
//                        the served bytes). If this drifts by one byte, every served/redirect vector
//                        mints a different id and fails — that is the identity-stability assertion.
//
// One host-supplied piece sits OUTSIDE the generated shell: the form CATALOG. Per OriginCore.cs the set
// of valid `form` values "is an implementation catalog, not part of the neutral contract", so the
// generated origin carries no catalog and cannot mint the unknown-form 400. A real .NET host owns that
// catalog; this host reproduces the contract's 400 shape for it. (That the generated shell lacks a
// form-validation SEAM is a #548 gap, filed separately; the neutral-contract behaviour — content
// addressing, caching, conditional GET, redirects — is what the generated code is held to here.)

using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using FrontierUI.Maas.Generated;

namespace FrontierUI.Maas.ConformanceHost;

internal static class Program
{
    /// <summary>Vector paths are origin-relative; the generated origin needs an absolute URL — mount under one host (mirrors referenceTarget.ts).</summary>
    private const string TestOrigin = "http://maas.test";

    /// <summary>The IR-observed response headers the runner compares, by exact wire name (mirrors runner.ts OBSERVED_HEADERS).</summary>
    private static readonly string[] ObservedHeaders =
    {
        "Content-Type", "Cache-Control", "ETag", "Location",
        "X-MaaS-Producer", "X-MaaS-Integrity", "X-MaaS-Lossy", "X-MaaS-Diagnostic",
    };

    /// <summary>The host's form catalog (mirrors moduleService.ts FORMS ids) — an implementation catalog, not the neutral contract.</summary>
    private static readonly string[] KnownForms = { "declarative", "wc-class", "html", "jsx", "functional" };

    private static async Task<int> Main(string[] args)
    {
        if (args.Length < 2)
        {
            Console.Error.WriteLine("usage: MaasConformanceHost <golden.json path> <out.json path>");
            return 2;
        }

        var goldenPath = args[0];
        var outPath = args[1];

        var vectors = JsonSerializer.Deserialize<List<Vector>>(
            await File.ReadAllTextAsync(goldenPath),
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
            ?? throw new InvalidOperationException($"could not parse golden vectors at {goldenPath}");

        var responses = new Dictionary<string, ActualResponse>(StringComparer.Ordinal);
        foreach (var vector in vectors)
            responses[vector.Name] = await RunVectorAsync(vector);

        // camelCase property names so the emitted JSON IS the runner's neutral ActualResponse shape
        // ({ status, headers, body }); dictionary keys (header names like "Content-Type") are untouched.
        await File.WriteAllTextAsync(
            outPath,
            JsonSerializer.Serialize(responses, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                WriteIndented = false,
            }));
        return 0;
    }

    private static async Task<ActualResponse> RunVectorAsync(Vector vector)
    {
        var url = Absolute(vector.Request.Url);

        // Host responsibility (form catalog): a valid MaaS path carrying an unknown form gets the
        // contract's 400, exactly as moduleService.ts/FORMS drives it in the JS reference.
        if (TryUnknownFormError(url, out var formError))
            return formError;

        var fixture = vector.Fixture;
        var origin = new GeneratedMaaSOrigin(
            resolveDefinition: name => name == fixture.Component ? fixture.Definition : null,
            transform: (_definition, _ignored, _params, _producer) =>
                Task.FromResult(new TransformResult(
                    fixture.Transform.Code,
                    fixture.Transform.Language,
                    fixture.Transform.Lossy,
                    fixture.Transform.Diagnostics)),
            identity: (_definition, result, paramMap, producer) =>
                Task.FromResult(ComputeIdentity(fixture.Definition, result, paramMap, producer)),
            producer: fixture.Producer);

        var response = await origin.HandleAsync(new OriginRequest(url, vector.Request.Headers));
        return Normalize(response);
    }

    // ── #088 identity, reproduced byte-for-byte from fetchHandler.ts computeArtifactIdentity ──────────
    //
    //   definitionHash = sha256Id(definition)
    //   canonical      = JSON.stringify({ definitionHash, compilerVersion, params })   // params: form[,target][,strategy]
    //   id             = sha256Id(canonical)            // sha256-<base64url, no padding>
    //   integrity      = sha256Integrity(result.code)   // sha256-<standard base64>

    private static ArtifactIdentity ComputeIdentity(
        string definition,
        TransformResult result,
        IReadOnlyDictionary<string, string?> paramMap,
        string producer)
    {
        var definitionHash = Sha256Id(definition);
        var canonical = CanonicalInput(definitionHash, producer, paramMap);
        return new ArtifactIdentity(Sha256Id(canonical), Sha256Integrity(result.Code));
    }

    /// <summary>Rebuild `JSON.stringify({ definitionHash, compilerVersion, params })` exactly — stable key order, undefined params omitted.</summary>
    private static string CanonicalInput(string definitionHash, string producer, IReadOnlyDictionary<string, string?> p)
    {
        var paramsBody = new StringBuilder("{");
        // `form` is always defined in the JS reference (defaults to 'wc-class'); a null is kept as the
        // JSON literal `null`, matching JSON.stringify (only `undefined` is dropped).
        paramsBody.Append("\"form\":").Append(JsonValue(p.TryGetValue("form", out var form) ? form : null));
        AppendIfPresent(paramsBody, "target", p);
        AppendIfPresent(paramsBody, "strategy", p);
        paramsBody.Append('}');

        return new StringBuilder("{")
            .Append("\"definitionHash\":").Append(JsonString(definitionHash))
            .Append(",\"compilerVersion\":").Append(JsonString(producer))
            .Append(",\"params\":").Append(paramsBody)
            .Append('}')
            .ToString();
    }

    private static void AppendIfPresent(StringBuilder sb, string key, IReadOnlyDictionary<string, string?> p)
    {
        // target/transpileTarget and strategy come through as `undefined` when absent in the JS reference,
        // so JSON.stringify omits them; the generated origin passes them as null — omit those too.
        if (p.TryGetValue(key, out var v) && v != null)
            sb.Append(',').Append(JsonString(key)).Append(':').Append(JsonString(v));
    }

    private static string JsonValue(string? s) => s == null ? "null" : JsonString(s);

    /// <summary>Escape a string exactly as JSON.stringify does (the simple values here need only the control set).</summary>
    private static string JsonString(string s)
    {
        var sb = new StringBuilder("\"");
        foreach (var c in s)
        {
            switch (c)
            {
                case '"': sb.Append("\\\""); break;
                case '\\': sb.Append("\\\\"); break;
                case '\b': sb.Append("\\b"); break;
                case '\f': sb.Append("\\f"); break;
                case '\n': sb.Append("\\n"); break;
                case '\r': sb.Append("\\r"); break;
                case '\t': sb.Append("\\t"); break;
                default:
                    if (c < 0x20) sb.Append("\\u").Append(((int)c).ToString("x4", CultureInfo.InvariantCulture));
                    else sb.Append(c);
                    break;
            }
        }
        return sb.Append('"').ToString();
    }

    private static byte[] Sha256(string input) => SHA256.HashData(Encoding.UTF8.GetBytes(input));
    private static string Sha256Id(string input) =>
        "sha256-" + Convert.ToBase64String(Sha256(input)).Replace('+', '-').Replace('/', '_').TrimEnd('=');
    private static string Sha256Integrity(string input) =>
        "sha256-" + Convert.ToBase64String(Sha256(input));

    // ── form catalog 400 (host responsibility) ───────────────────────────────────────────────────────

    private static bool TryUnknownFormError(string url, out ActualResponse error)
    {
        error = default!;
        var uri = new Uri(url);
        if (!uri.AbsolutePath.StartsWith(OriginCore.BasePath, StringComparison.Ordinal)) return false;

        var query = System.Web.HttpUtility.ParseQueryString(uri.Query);
        var form = query["form"];
        if (form == null || KnownForms.Contains(form)) return false;

        var message = $"Unknown form \"{form}\". Known: {string.Join(", ", KnownForms)}.";
        error = new ActualResponse
        {
            Status = OriginCore.Status.BadRequest,
            Body = "{\"error\":" + JsonString(message) + "}",
            Headers = new Dictionary<string, string> { ["Content-Type"] = OriginCore.MediaTypes.Error },
        };
        return true;
    }

    // ── normalization to the runner's neutral shape ──────────────────────────────────────────────────

    private static ActualResponse Normalize(OriginResponse response)
    {
        var headers = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var name in ObservedHeaders)
            if (response.Headers.TryGetValue(name, out var value))
                headers[name] = value;
        return new ActualResponse { Status = response.Status, Headers = headers, Body = response.Body ?? string.Empty };
    }

    private static string Absolute(string url) =>
        url.StartsWith("http://", StringComparison.Ordinal) || url.StartsWith("https://", StringComparison.Ordinal)
            ? url
            : TestOrigin + url;
}

// ── the neutral output shape the runner consumes (status + observed headers + raw body) ──────────────

internal sealed class ActualResponse
{
    public int Status { get; set; }
    public Dictionary<string, string> Headers { get; set; } = new();
    public string Body { get; set; } = string.Empty;
}

// ── golden.json deserialization model (only the fields the host needs) ───────────────────────────────

internal sealed class Vector
{
    public string Name { get; set; } = string.Empty;
    public Fixture Fixture { get; set; } = new();
    public RequestModel Request { get; set; } = new();
}

internal sealed class Fixture
{
    public string Component { get; set; } = string.Empty;
    public string Definition { get; set; } = string.Empty;
    public string Producer { get; set; } = string.Empty;
    public TransformModel Transform { get; set; } = new();
}

internal sealed class TransformModel
{
    public string Code { get; set; } = string.Empty;
    public string Language { get; set; } = string.Empty;
    public bool Lossy { get; set; }
    public List<string> Diagnostics { get; set; } = new();
}

internal sealed class RequestModel
{
    public string Url { get; set; } = string.Empty;
    public string Method { get; set; } = "GET";
    public Dictionary<string, string> Headers { get; set; } = new();
}
