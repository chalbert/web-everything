# The Front-End Platform

> **Reference / archival.** An early, long-form design essay by the author that predates the Web Everything constellation and is its conceptual ancestor — many current ideas (Module-as-a-Service, the provider/registry pattern, native-first defaults, the conformance/platform dashboard, the "evergreen app") descend from it. Rescued verbatim from an unsaved editor buffer on 2026-06-06 and grammar-corrected; technical content and intent are unchanged. Linked from backlog items #099 onward.

This book should avoid mentioning specific libraries, and instead focus on patterns, methods, etc. Independent guides can be published with recommendations for a specific framework. Those will have to be updated much more regularly, and are more subject to preferences.

This book is designed so that new iterations can be easily added. It also encourages forks.

Something critical with a Platform is to keep improving. We have to identify our ideal state and find a trajectory that brings us as close as possible to it. In this book, we will try to identify what an ideal solution would look like, even if it is not presently possible or practical. Only by doing so will we keep pushing the limit of what can be achieved.

## Contents

- [Values](#values)
  - [Visibility](#visibility)
  - [Respect](#respect)
- [Goals](#goals)
- [Principles](#principles)
  - [Accessibility](#accessibility)
  - [Usability](#usability)
  - [Performance](#performance)
  - [Brand and image](#brand-and-image)
  - [Flexibility](#flexibility)
  - [Productivity](#productivity)
  - [Security](#security)
- [CEO](#ceo)
- [The platform](#the-platform)
  - [When to create a Platform](#when-to-create-a-platform)
  - [Evolving the Platform](#evolving-the-platform)
    - [The strategy of two ends](#the-strategy-of-two-ends)
    - [The Platform is not a Framework](#the-platform-is-not-a-framework)
    - [Standard based](#standard-based)
    - [Module as a service](#module-as-a-service)
    - [Single Page App](#single-page-app)
    - [Versioning](#versioning)
    - [Sharing code](#sharing-code)
  - [Freedom](#freedom)
  - [Maintenance](#maintenance)
    - [Auto-update](#auto-update-1)
    - [Incremental update](#incremental-update-1)
  - [Perennity](#perennity)
  - [Change management](#change-management)
  - [Integration vs development](#integration-vs-development)
    - [The purest form](#the-purest-form)
    - [Platform directory](#platform-directory)
  - [App status](#app-status)
  - [Deprecation strategy](#deprecation-strategy)
  - [Incremental progress](#incremental-progress)
  - [The ideal app](#the-ideal-app)
- [Organization](#organization)
  - [Team composition](#team-composition)
    - [Developer profiles](#developer-profiles)
  - [Business rules](#business-rules)
  - [Collaboration](#collaboration)
    - [Team profile](#team-profile)
    - [Team Design](#team-design)
    - [Team Culture](#team-culture)
  - [Common language](#common-language)
- [Developer Experience](#developer-experience)
- [Platform Architecture](#platform-architecture)
  - [Libraries](#libraries)
    - [Code](#code)
  - [Scripts](#scripts)
  - [Code format](#code-format)
  - [Command line interface](#command-line-interface)
  - [Usefulness scale](#usefulness-scale)
- [App architecture](#app-architecture)
  - [File structure](#file-structure)
  - [Module scope](#module-scope)
  - [Nomenclature](#nomenclature)
  - [Scope](#scope)
    - [Actions](#actions)
    - [State](#state)
  - [Business logic](#business-logic)
    - [Class vs plain objects](#class-vs-plain-objects)
  - [Loading](#loading)
  - [Imports](#imports)
    - [Relative vs absolute imports](#relative-vs-absolute-imports)
    - [Dependency injection](#dependency-injection)
- [Infrastructure](#infrastructure)
  - [Typechecking](#typechecking)
  - [Transpiling](#transpiling)
  - [Polyfilling](#polyfilling)
  - [Code format](#code-format-1)
    - [How to migrate a project to a different code format](#how-to-migrate-a-project-to-a-different-code-format)
  - [Environment variables](#environment-variables)
    - [Modes vs environments](#modes-vs-environments)
  - [Development server](#development-server)
    - [Authentication](#authentication)
  - [Mocks](#mocks)
  - [Web Service Proxy & Console](#web-service-proxy--console)
  - [Scripts](#scripts-1)
    - [Start](#start)
    - [Build](#build)
    - [Test](#test)
    - [Optimization](#optimization)
  - [Monitoring](#monitoring)
- [Testing](#testing)
  - [Pre-testing](#pre-testing)
  - [Front-end test pyramid](#front-end-test-pyramid)
    - [Unit tests](#unit-tests)
    - [Integration tests](#integration-tests)
    - [Acceptance tests](#acceptance-tests)
    - [Smoke tests](#smoke-tests)
    - [Visual regression tests](#visual-regression-tests)
    - [Cross Browser tests](#cross-browser-tests)
  - [Test ID](#test-id)
- [Source control](#source-control)
  - [Branch strategy](#branch-strategy)
- [Modules](#modules)
  - [Module types](#module-types)
    - [Components](#components)
    - [Resources](#resources)
    - [Utils](#utils)
    - [Formatters](#formatters)
    - [Validators](#validators)
    - [Higher Order Components](#higher-order-components)
    - [Constants](#constants)
    - [Transformers](#transformers)
  - [Component Types](#component-types)
    - [Utility components](#utility-components)
    - [Visual components](#visual-components)
    - [Integration components](#integration-components)
    - [Widget components](#widget-components)
    - [Views](#views)
    - [Layouts](#layouts)
    - [Presentation components](#presentation-components)
    - [Passive components](#passive-components)
    - [Interactive components](#interactive-components)
  - [Component patterns](#component-patterns)
    - [Abstract components](#abstract-components)
    - [Interface components](#interface-components)
- [Features](#features)
  - [Theme](#theme)
    - [Colors](#colors)
    - [Fonts](#fonts)
    - [Icons](#icons)
    - [Logos](#logos)
  - [Routing & navigation](#routing--navigation)
  - [Scrolling](#scrolling)
  - [HTTP requests](#http-requests)
  - [Tracking](#tracking)
    - [Tracking types](#tracking-types)
    - [Reporters](#reporters)
  - [Logging](#logging)
    - [Log levels](#log-levels)
    - [Namespace (scope, context, realms?)](#namespace-scope-context-realms)
  - [A / B testing](#a--b-testing)
  - [Feature toggle](#feature-toggle)
  - [Internationalization](#internationalization)
    - [Translation](#translation)
    - [Formatting](#formatting)
- [Styling](#styling)
  - [CSS units](#css-units)
  - [Layout type](#layout-type)
  - [Positioning](#positioning)
  - [Portals](#portals)
  - [Overflow](#overflow)
- [UI & UX](#ui--ux)
  - [What should be provided to programmers](#what-should-be-provided-to-programmers)
  - [Responsive design](#responsive-design)
    - [Responsive layout](#responsive-layout)
    - [Accessing the breakpoint from JavaScript](#accessing-the-breakpoint-from-javascript)
    - [Watching an element's size](#watching-an-elements-size)
    - [Touch friendliness](#touch-friendliness)
  - [Grid](#grid)
  - [Units](#units)
  - [Breakpoints](#breakpoints)
- [Component Oriented Design](#component-oriented-design)
  - [Browser rendering](#browser-rendering)
  - [Loading & waiting](#loading--waiting)
  - [Selecting](#selecting)
    - [Native vs custom selects](#native-vs-custom-selects)
  - [Searching](#searching)
  - [Quick actions & action bar](#quick-actions--action-bar)
  - [Browser, device & feature detection](#browser-device--feature-detection)
  - [Browser APIs](#browser-apis)
  - [Shortcuts](#shortcuts)
  - [Charts](#charts)
  - [Documenting](#documenting)
- [Plateau Standards](#plateau-standards)
  - [Spacing Standard](#spacing-standard)
  - [Grid Standard](#grid-standard)
  - [FlexRow Standard](#flexrow-standard)
  - [Breakpoint Standard](#breakpoint-standard)
  - [Changelog Standard](#changelog-standard)
  - [Granular Import Standard](#granular-import-standard)
  - [Private module Standard](#private-module-standard)
  - [Nomenclature Standard](#nomenclature-standard)
  - [Mock Standard](#mock-standard)
  - [Global State Standard](#global-state-standard)
  - [Action Standard](#action-standard)
  - [Module Manifest Standard](#module-manifest-standard)
- [Plateau Services](#plateau-services)
- [Analysis](#analysis)
- [Monitoring](#monitoring-1)
- [Development Tools](#development-tools)
  - [Browser Dev Tools](#browser-dev-tools)
  - [Wireshark & equivalent](#wireshark--equivalent)
  - [Platform Tools](#platform-tools)
    - [Analyzers](#analyzers)
    - [Generators](#generators)
    - [Editors](#editors)
- [Dashboard](#dashboard)
- [About WebAssembly](#about-webassembly)
- [The frameworkless future](#the-frameworkless-future)
- [The evergreen app](#the-evergreen-app)
- [References](#references)

## Values

Recommend a certain list of values, and suggest selecting those that matter most.

### Visibility

- Clarity
- Transparency

### Respect

It's a choice, not a necessity. It should help engagement. Public backlog, roadmap. Be inclusive, encourage contribution. Changelog management.

Could accessibility be a priority even if it does not benefit the company? Is it too obvious a value — nobody will say no to respect.

## Goals

- Reduce costs
- Manage risk
- Maximize impact

## Principles

### Accessibility

- Contrasts
- Screen readability
- Keyboard accessibility

### Usability

Usability testing

### Performance

- Loading performance
- Low latency
- Low size

React things to know.

- Long updatable list
- DOM manipulation

### Brand and image

Work experience

User experience

### Flexibility

Adapt to every need. Take team and project differences into account.

### Productivity

Or velocity, speed. But prefer "productivity" as it relates to value delivered and not purely speed.

### Security

SEO

If public facing.

## CEO

## The platform

There is not a single kind of Platform. Deciding to build a Platform is less about its shape than its intention; less the how than the why. It's the conscious decision that every app in your organisation shares common goals and values, common challenges and solutions, common constraints and needs, and often, common users, creators and stakeholders. The recognition that all apps have a lot in common exposes the opportunity for those apps to benefit from each other. Those benefits can take multiple forms: code, tools, practices, experiences, etc.

Building a Platform is not building a framework. Apps in your Platform may each use a different framework. Or they could all use the same. It's up to your Platform's needs. Defining a Platform requires defining your objectives and the strategy that best brings you toward them. It's having the visibility to know how far you are toward these objectives, and how far you still have to go.

### When to create a Platform

Not every organisation should consider creating a Platform, and not every Platform should try to accomplish the same things. The more consistent the needs — especially the UI patterns — the more useful it will be. But even very different apps can benefit from sharing some elements, and from the visibility. In fact, it's when there are big differences that it's most useful to have oversight on the various applications of our organisation.

### Evolving the Platform

A trap we cannot afford to fall into is freezing our Platform in place. A good Platform should instead allow us to increase innovation, and in particular the diffusion of innovation.

#### The strategy of two ends

Identify the ideal (but realistic) state, and the next steps.

#### The Platform is not a Framework

A Platform can be made of one, many, or no framework at all. The Platform's job is to expose those usages, and oversee them. A Platform may decide to allow multiple frameworks without constraint, or impose guidelines on when to use one framework or another, or again require a specific framework to be used. What matters is the cost-value analysis, following our Principles, of one strategy or another. The absence of those guidelines will result in additional cost and even more loss of opportunity.

#### Standard based

We ideally want to get as much out of any app as possible. In an ideal world, common code should be shared across apps of the same Platform, even across different frameworks. Using Web APIs as much as possible is our first and best option. Those APIs come preloaded inside the browser, are standardized, stable and well documented. Of course, although the Browser APIs are constantly improving, there remain many, many aspects common to every app of our Platform that would benefit from being shared.

The approach I propose goes in steps. Each step brings some benefit, but requires some effort and incurs a cost. You may decide to take all the steps to the end, or stop along the way where you deem you benefit the most.

- No standard. Each app is free to do as it pleases. Benefits: flexible, no dependency, quick to apply changes. Disadvantages: a small app is unlikely to develop good-quality design, loss of time due to arguing and designing in every app, etc. To complete.
- Adopt a standard, but leave the implementation to each app. Benefits: little dependency, flexible, etc. To complete.
- Create an abstraction as a library.
- Use a module-as-a-service (MAS) within your organisation.
- Use a public module-as-a-service.

#### Module as a service

MAS is a technique that implies requesting a dynamically generated JavaScript file. The content of the file is modified by the arguments passed to it, either in the path, its query parameters, its headers, or any other information available.

Aspects that can be modified include: language, device & feature support, features, optimization, transpiling, etc.

Example:
A polyfill service that returns polyfills specific to the current browser.

The MAS should ideally be highly distributed on a CDN and very efficiently cached. They should be considered like a standard JavaScript file from the consumer's point of view. They can be included either directly in the .html file, or dynamically imported from a module. They should never be bundled inside your app.

It is possible (and desirable) to provide your own MAS (possibly multiple different services). Some services may also offer their own. A popular, public MAS may have the additional benefit of providing extra caching if you visit other websites using the exact same service.

A MAS imported directly as a script should expose a public API directly on the window object. When imported from a module using dynamic import, it should come completely encapsulated.

##### Evergreen module-as-a-service

A MAS should be versioned using strict semver. An app may then decide to either point to a specific version, a version range, or omit the version altogether.

A specific version will require you to manually update, even for non-breaking changes. It has the disadvantage of not getting the latest bug fixes in exchange for a more controlled experience. It may also provide additional caching benefit if not using incremental update.

A version range specifies whether patch or minor versions are accepted. This is usually the safest and most desirable option, in particular with incremental update that avoids refetching the entire file with each change.

An unversioned module-as-a-service always takes the latest version. This may be fine for experimental or in-development projects, but is less likely to be acceptable in production.

##### Auto-update

Auto-update of a MAS is a highly desirable state we should be working toward. It of course implies a very strong automated testing suite able to identify any problem, visual or functional, when updating to a new version of the app. The Plateau Changelog standard may help manage the auto-update flow.

##### Incremental update

Sharing a large bundle of code among apps may be very beneficial, but not if it has to be reloaded too often. In an active Platform, a MAS can be updated multiple times a day, removing in large part the benefit of caching. The correct way of managing this is to implement an incremental update mechanism. Multiple ways of achieving this are described in Automatic Update.

##### The ideal approach to MAS

Our ideal state concerning MAS is the following:
- Any common code between apps is served as MAS, including libraries.
- We use a version range to benefit from bug fixes.
- Auto-update, even to major versions, following best practices (phased, reversion protocol, monitoring, reporting with risk analysis based on the changelog, approval required for visual differences, approval for high-risk updates, etc.).
- Incremental update, using a service worker.

##### Security

Checksum? Prevent hijacking. This would be important for MAS. Surely there must already be some solutions.

##### Uniformity

Uniformity should never be a goal by itself. Uniformity, alone, does not bring any value, but often holds a cost, direct or in loss of opportunity. But uniformity can be a very useful tool.

A reticence I often encounter is the sentiment that, in building a Platform, the intention is to have identical apps. Experienced developers will know that doing so is very difficult, and also comes with important challenges. Even in a tightly aligned Platform, I believe it is critical to be as flexible as possible and always allow apps to go outside the mold. Not doing so will likely create discontent and hurt adhesion to the vision. Education becomes an important part of the Platform's viability, so that developers understand how their creativity may still be expressed, and fully understand the goals the Platform is trying to achieve.

It is also worth noting that having strong guidelines and visualization tools does not prevent you from building apps completely outside them. The philosophy of the Platform would be to still track this experiment from within the Platform so it is visible. It might also be worth identifying why following the Platform's standards was not possible, and whether there would not be an opportunity to improve the Platform to be more flexible. In real life, in a standard-based Platform like the one we are pushing, it's very rare that you have to ditch every aspect of the Platform. You may want to experiment with a new state management system for an app with a highly unusual need, but you probably don't need to drop the logger, styles, env variables, error management, mocks, etc. Take those special apps not as black boxes that have nothing to do with the Platform, but as an opportunity to extend it, and maybe provide the same features to other apps in the future.

#### Single Page App

##### Micro Apps

Micro apps is a concept inspired, at least in part, by micro-services. It describes the practice of developing a multitude of small apps instead of one large app. Whereas one of the advantages of micro-services is to allow the deployment of said service completely independently from each other, the constraints of the front-end may not allow us the same level of freedom.

- Different teams
- Different frameworks

Different frameworks should be supported, but not encouraged. It's less about giving a team the freedom to go out of the box, than giving the Platform the freedom to evolve.

Address:
- Communication
- Shared state, global variables

References:
- https://micro-frontends.org/
- https://medium.com/@tomsoderlund/micro-frontends-a-microservice-approach-to-front-end-web-development-f325ebdadc16#:~:text=The%20common%20term%20is%20%E2%80%9Cmicro,to%20build%20their%20web%20apps.

##### Variants of micro-apps

Meta framework
- One big SPA that allows multiple frameworks inside, with a pure JS abstraction on top.
- A collection of small SPAs that look the same, but are loaded independently.

A collection of SPAs is not really a micro-frontend; it's the standard multiple-app paradigm.

##### Constraints to micro-apps

The first constraint resides in our desire to favor Single Page Apps (SPA) as much as possible. From a user-experience point of view, the benefits are just too important to ignore. In this context, micro-apps should be loaded within our Single Page, even when developed as a different project by a different team. This is not to say that every application of a company is bundled in one large app. There remains a logical separation by project and target user. But if, from a user's point of view, it is considered a single app, then ideally it should be a SPA.

There are two approaches that can be followed for organizing our micro-apps.

- Monorepo
- Separate repos.

If we accept that our micro-apps will be served as part of one common SPA, it imposes many design details. Here are some requirements to take into account.

- Avoid reloading the same thing twice.
- Avoid loading code that is not used yet.
- Avoid conflicts.

The most important of the three is to avoid conflicts.

Memory management. When in a single SPA, you cannot load stuff infinitely, even if conflicts are managed.

##### Ideal micro-apps setup

An abstract container (meta-framework style / App Shell) with little to no dependencies. It manages loading and routing of pages that are the actual micro-apps. Each app has a compatibility chart. When navigating to a page, it would determine if it can be loaded as part of the same SPA (compatible) or not. If not compatible, it would do a hard refresh. This logic would likely be handled by the MAS required for the new page. It would also handle the bundle based on what is already loaded, thus ensuring limited to no reloading of content.

The Platform would then expose a compatibility map showing which page is compatible with what. This would expose pages that would benefit from a conversion.

With time, specific design patterns would help reduce the number of incompatible apps, as well as the cost of migrating an app.

- Standardized features in pure JS format, loaded as a Platform-level MAS. The more stuff is put into a framework-agnostic layer, the more compatible it will remain with time.
- Adapters to convert older setups to new APIs, without having to load the old implementation. This means that APIs need to be dependency-injected.
- MAS with version range, instead of fixed version.
- Auto-updatable apps.
- Web Components for the base UI layer.

With each passing year, the Platform API layer and the Web Component layer should grow, to leave less and less space for the framework-based micro-app. Many apps may eventually become frameworkless.

Notes: There are very good docs / blogs on micro frontends. It has really developed, and most agree on the basics. It would be good to take note of what is read to show references, even if no longer available. This book probably should not be a full analysis of micro-apps, but a summary, always bringing it back to the Platform. The Platform encompasses multiple macro-apps.

#### Versioning

It's always a good idea to expose a version on the app.

Versioning for components. The challenge of aligning versions. While having a version for each component seems nice, unless you have an automatic system that manages dependencies and conflicts, you may be better off publishing a new version at the library level.

Versioning is very much tied to the library design, i.e. how many libraries to use, what to share in a library and when.

At one end of the spectrum, each module, component or otherwise, is published individually.

##### NPM module vs library

There is a distinction to be made between where the source code is held — either in its own repo or within a common repository — and how the module is published — either as a single NPM module or as part of a shared library.

Having modules in standalone repos gives great freedom on the build system and dependency management of each module. Conversely, having many standalone modules may increase the cost of managing many builds, packages and dependencies. For common JS architectures where many small modules are created, it is rarely sustainable to manage dozens upon dozens of those small modules, and it should only be considered if it is automated — although there might still be some occasional maintenance that requires manual intervention on every module. In my experience, companies that have used this strategy have come to regret it.

Having a single library is at the other end of the spectrum. A single build system and structure makes it easier to maintain. There is no dependency management between any of the shared modules.

The structure I would recommend is this one: use as few repos as possible from a development point of view. Start with one common shared repo with all your shared code. The constraint that will require you to split a part of the code into a new repo is a development constraint, for example:
- Enabling a different team to publish versions without requiring approval from a wider team.

Splitting a library into a different npm module should be dictated by some consumer constraint:
- Difficulty managing dependencies.
- Having to regularly update dependencies without getting any benefit.

Reasons that should not be used to split a repo into different ones:
- A desire to only load a part of the library. There are better approaches, either through tree shaking or granular loading.

#### Sharing code

Also not a goal by itself, but a tool. It creates a dependency. Adopting a standard is often a better solution than simply sharing code, but sharing code remains essential to achieve several of our goals (productivity, UX, etc.).

My recommendation is to prepare early but share late: split the code in the app the same way it would get shared, but only move it to a different library once there is an obvious need. The cost of having to update an external library will always be greater than managing a module within the app itself.

### Freedom

The freedom of making decisions is often a point of conflict within an organisation trying to establish a Platform. It is common for developers to have a strong desire to innovate and experiment, and indeed it is a valuable mindset. Those are often the best developers from a technical point of view, and it would be a waste not to harness their motivation.

- Innovate within the Platform.
- Innovate within the boundaries of an app.
- Contribute to the Platform: libs, tools, scripts, etc.
- Have them engage and buy into the Platform.

### Maintenance

Track outdated modules.

Track adoption of standards.

If an app has good automated support, then it can be refactored. Automated testing is the key.

An app that followed the Platform's best practices during its creation should be simple enough to migrate.

We should have a clear maintenance protocol. Each app is given a rating. If it is deemed a long-term application, it should be maintained — not necessarily by its creator. A clear mandate of what it means (avoid useless and risky refactors).

Auto-update is the future.

#### Auto-update

The capacity of an application to update itself to the latest version of some libraries, tools or practices. It depends on advanced automated tests, potentially supported by human intervention.

For external libs, schedule-based. For Platform updates, ideally automatically tested before the new version is released, using pre-test, so its compatibility is already confirmed.

Failed auto-updates are tagged for human intervention. Criteria for human intervention can also be specified.

#### Incremental update

Service worker if available. The MAS can offer the delta from the previous version, in the form of a patch or new modules.

##### Patch

The previous module is kept, and then the patch is applied on top. This allows smaller updates.

##### Full module update

The new module is completely updated and replaced in the cache.

##### Storage

Ideally use async storage. It is limited, but should not be an issue. Service workers have the special Cache API.

### Perennity

We must let practices evolve or die.

### Change management

The platform cannot afford to stay stuck in the past, nor can it afford to constantly follow every whim. It's about having a strategy. Change will be regular, not immediate. It'll follow a schedule. A cool-off period will be observed for any new technology, as well as an impact analysis and migration plan, if necessary.

### Integration vs development

Integration = take existing code and put it together using mostly configuration.
Development = create new functionality by designing, engineering and coding.

#### The purest form

What is the simplest way to express the nature of an app.
What is the minimum number of steps required to achieve it.

#### Platform directory

One of the most important elements for a successful Platform is to have visibility on its entire perimeter: the apps, libraries, modules, teams and people that are or should be part of it.

Here is a list of information that should be known:

- The complete list of applications with a front-end.
- The complete list of shared code used by any of those applications.
- The technology stack of those applications.
- The status of those products (active development, standby, dead).
- The dependencies between those apps, internal libraries and external libraries.
- The update status of those products.
- The adherence of each of those products to each of the Platform standards.
- The team responsible for the development and/or maintenance of each product, including individual team members.

Other interesting information to expose on the directory:

- Links to each environment.
- Test accounts and guidelines to use them.
- Links to repos.
- Links to builds.
- Test results.
- Logs and analytics.
- Test plans.
- Backlogs.

Ideally, this Platform directory will be as close to real life as possible. As a cost-saving measure, updating the status at a regular interval between 1 and 7 days seems reasonable to me.

### App status

Active development, standby, dead, etc.

A table with examples of application statuses. Each Platform should define its own criteria.

### Deprecation strategy

We must be able to prune dead parts. Different approaches.

Avoid deprecation:
- Fewest dependencies possible.

Manage deprecation:
- Identify usages.
- Always show a warning before removing. Publish the deprecation. Contact teams. Offer a PR service.
- Offer an adapter, or move it to a standalone module to preserve support when possible.
- Flag projects that are not compatible anymore. Have a process to raise visibility. It could go as far as requiring sign-off by the person responsible for the app.

How to handle changes to existing UI patterns. It's problematic (but common) to completely change how a certain pattern is handled. Even the best theming cannot cover a major redesign. The handling of existing apps is of course a major preoccupation. Creating a major version is possible, but managing multiple major versions of components is complex and costly. A new component is possible, but living alongside its old variant may be seen as debt. That's where v2 components appear. Aggressive deprecation is of course better, but can only be managed with a strong hold on the Platform. If the new redesign takes place as part of a broader new design, it may be worth creating a new library, and taking the opportunity to abstract what is common to the two designs, and split what is specific to a design. Abstract components could then be used with any version. The legacy library would be slowly phased out. If it is a single component, the same strategy can happen from within the lib.

What about:
- Use a flag that controls which version is used.
- First, the new version is under a flag, with a warning on the old one that a new version is being tested and will soon be included.
- The new version replaces the old, even with breaking changes. But a flag allows reverting to the old one. This step could be skipped and move straight to 4.
- After a pre-established schedule, the old component is moved to the legacy lib.

### Incremental progress

Small projects cannot be used to improve practices. It's the job of larger projects. A project should always analyze what it can offer. Dependencies and similarities between projects should be identified.

### The ideal app

Just-before-need loading.

This section would pretty much summarize, in an easily consumable format (a table?), every decision. It would maybe be worth differentiating the today, realistic ideal situation from the theoretical version.

## Organization

### Team composition

Designers, developers, analysts, architects, stakeholders.

#### Developer profiles

A table with different criteria, and more of a rating than an absolute definition. The journeyman is less creative than other profiles, but that does not mean they are not creative at all.

##### The journeyman

Follows guidelines, won't research or read at night. Patient and open to doing the same thing. Not frustrated by repetition or lack of challenge.

##### The artist

Needs it to be beautiful, perfect. The appearance (visual or in the code) is important.

##### The inventor

Frustrated by repetition. Likes to reinvent the wheel and would love nothing better than refactoring behind other devs.

##### The pragmatic

Does not like to lose any time. Likes to optimize workflow more than code. Searches for more efficient ways to work. Searches for compromises on UX. Often a disillusioned inventor or artist ;).

### Business rules

Bounded context. Go back to Domain Driven Design for a better understanding.

### Collaboration

#### Team profile

Not every team has international-level coders. We have to adapt our platform design to our team profile. It's not about downplaying anybody's contribution, but playing to everybody's strengths, while giving opportunities for growth.

A table with different profiles. It's a scale, and composition will vary depending on the company. A company is lucky if it has top-level developers, but they may also be more difficult to manage.

#### Team Design

The need (or not) for a centralized team.

Regular meetings. What power is given to the community. We must beware of a few individuals hijacking the community because of their personality or availability. If we want our Platform to be data- and fact-driven, we cannot just follow the loudest mouth. We have to give equal chance to different types of personality, and we must ensure representativity independently from availability. A team that is less present because of how its management operates does not have reduced needs — maybe the opposite.

#### Team Culture

It cannot be forced, just encouraged. It will often have to be demonstrated. It may never really take, so it cannot be expected. There will always be some people who participate. Don't forget, the Platform's goal is not to reward those who participate, but to provide value.

### Common language

Between: devs, designers, analysts, QA, PO.

For business logic, it is often better to adopt the existing language. You need to make sure it is understood.

With designers, it depends whether designers have the habit of assigning names to their patterns / components, or even whether they consciously normalize components. A very challenging aspect that may be hard without strong leadership. Ideally from a designer with input. It can work the other way, but only well if designers are open to adopting the language put forward by the devs. Otherwise, it's likely that components do not reflect the intention of the designer, which will be revealed by discrepancies once new designs emerge or existing designs are updated.

See deprecation strategy for how to handle major UI changes.

## Developer Experience

Workstation management
Tools version - keep up to date
Version of deps needed for each project.

Communication

In-person meetups.

What many developers need or are looking for (see types of devs).
Clarity
Challenge.

Getting Help

Friction.
Types of friction

## Platform Architecture

### Libraries

#### Code

Building a library is as much about what is shared as what is not shared. There is nothing easier than putting some code in a shared repo. If you plan on creating a complex ecosystem of components, though, you should have a well-thought-out design (strategy?). Sharing some code creates a dependency. Sharing a bad abstraction, or even a so-so abstraction, may be worse than a bit of repetition between two projects.

Bad smells:
- Very large components that do many, many things.
- You use a very small part of the component, thus loading useless code.
- The API is inconsistent with other components.
- It's buggy.
- It's importing a very large dependency that is barely used.
- It's not accessible.

When a component is shared across multiple projects, in different teams with little contact, a breaking change can be a big deal. If some projects have low test coverage, or are rarely updated, it amplifies the problem.

What should be done:
- Define strict standards on which the components will be built. Module name, code format, file structure, argument names, programming patterns, theming, units, breakpoints, translation, docs, icons, etc.
- Building a component library is like writing a language. Words are not created in isolation. For a language to feel real, a common etymology is shared.
- The internals may vary (even if a coherent library is preferable) but the external interfaces should not make it apparent.

### Scripts

### Code format

### Command line interface

### Usefulness scale

Rank apps on a usefulness scale from useless to purely useful (art to internal tool). Have a target usefulness level for the platform itself.

## App architecture

### File structure

### Module scope

Each file/module has an address: page/UserPage/components/Component1

### Nomenclature

Short vs long names
Unique names

### Scope

Define the scope across many features. Actions, themes, state, injectables, etc. Similar to bounded context? Alternative name: boundary, horizon.

Scope could be a single layer; horizon could be all the scopes a component can view and access.

#### Actions

Scoped actions. Reuse the same definition of scope.
Time travel.

Document macro-app communication and micro-app. A micro-app is much more free in implementation.

#### State

Global vs local state. Debugging must be a major point here.

### Business logic

#### Class vs plain objects

### Loading

Optimizing what and when it's loaded.

Avoid duplication. Split bundles.

### Imports

#### Relative vs absolute imports

#### Dependency injection

## Infrastructure

### Typechecking

What to look for in a solution.

### Transpiling

Babel, plugins, strategy (which level to adopt). As a service ideally, with only the required transpiling?

### Polyfilling

The ideal solution would be a MAS, only providing what is needed. Automatically based on usage, or manually imported.

### Code format

Whatever the tools, share the settings. Prefer a strict over a loose format. Auto-fix is a must-have feature.

#### How to migrate a project to a different code format

### Environment variables

#### Modes vs environments

Modes (dev, test, build) & environments (asmb, fnct, intg, accp, prod), silos, etc.

### Development server

HTTP2, module injection system, module-as-a-service? It's silly to precompile the whole app when you need only part of it...

Configurable port.

#### Authentication

- UI/UX
- Iframe vs redirection
- Session duration
- Token vs cookie
- Web Worker

### Mocks

Mocks should not be included in the code. You should not have conditions relating to mocks in any deployable file. Instead rely on a real HTTP server to transparently mock your API.

It should include:
- Add latency to a specific API or any API.
- Trigger exceptions of different kinds, standard (401) or more specific (400 with some body).
- Allow conditions to be coded to modify content based on params, query params, headers, etc.
- It may include a session, but preferably not if you can avoid it.
- Auth, including fake OAuth when needed.
- Real endpoints.
- Reload from endpoint.
- Proxy to endpoint.
- Tracking, monitoring.
- Change detection / respect of contract.

Configurable via a JSON file, the dashboard, or special query params / headers.

### Web Service Proxy & Console

Allow pointing to different services, without CORS. Allow turning services on/off with specific codes, either with a header, a param or via the Console.

Integrated with the Mocks console.

### Scripts

#### Start

#### Build

#### Test

#### Optimization

- Server side rendering
- HTTP2

Container
Develop as a service

### Monitoring

Including tracking regressions, visual or functional, in prod. This is especially important if we do auto-update, but actually always useful. Automated reversion protocols.

## Testing

### Pre-testing

Automatically test an update before it is released, to discover any regression.

### Front-end test pyramid

#### Unit tests

#### Integration tests

#### Acceptance tests

#### Smoke tests

#### Visual regression tests

#### Cross Browser tests

### Test ID

## Source control

### Branch strategy

## Modules

### Module types

#### Components

#### Resources

#### Utils

#### Formatters

#### Validators

#### Higher Order Components

#### Constants

#### Transformers

Type of formatter? Usage is different.

### Component Types

#### Utility components

#### Visual components

#### Integration components

#### Widget components

Droplist

Calendar

#### Views

A component associated with a route.

#### Layouts

A component with a section in which a view is displayed, and that has a part that does not change when the view changes.

#### Presentation components

#### Passive components

#### Interactive components

Types of controls

- Multi-select options: multi-select, multi-select tree, checkboxes, toggles.
- Mono-select options: select, tree, radio, toggle.
- Free text - single line
- Free text - multi line
- Free text - formatted
- Suggestions vs filters (can or cannot enter non-defined options).

Datepicker

- Mono or multi dates.
- How many months shown at a time.
- Can see month list.
- Can see year list.
- Month dropdown.
- Year dropdown.
- Free text.
- Multi format.
- DoB.

- Start and end limit.
- Day-of-week limit.
- Date before another.
- Invalid format.
- Invalid date.
- Dropdown.

Timepicker

Inputs: text, number, currency, NAS, phone.

Toggles

Radio buttons

Checkboxes.

### Component patterns

#### Abstract components

#### Interface components

## Features

### Theme

#### Colors

Semantic colors

#### Fonts

#### Icons

Icon types. SVG property to look for, e.g. fill to use the font color.

#### Logos

### Routing & navigation

Path vs hash
Views
Segments and params
Nesting

ASM
Usages and limitations.

- Web workers
- Service workers

### Scrolling

Scroll container.

Scroll snap: realigns to content.

Scroll behavior: smooth/bounce.

Sticky content

### HTTP requests

- Unique id.
- Should be embeddable - can be included in a component.
- Consistent.
- Interceptors.
- Transformations.
- Normalization.

### Tracking

#### Tracking types

- Navigation
- Interaction
- Goal

Success, failure, progress.

#### Reporters

### Logging

#### Log levels

Log hierarchy (prefer no hierarchy)

#### Namespace (scope, context, realms?)

### A / B testing

### Feature toggle

### Internationalization

#### Translation

Ideally, only the current language is loaded. When changing language, either in place, or with a page reload. In-place implies that either the other language is already loaded, or that it will be loaded async. There is probably little benefit to in-place translation, unless the number of languages is very small and preloaded. The complexity of async loading is probably not worth it, as the cost of reloading is very little. Also, in-place becomes complex when some of the translation relies on the response from services. Again, only possible if the number of languages is small and always returned by the services. The alternative is not really worth considering, as refreshing the services might bring some challenges unique to certain flows.

Even better if the language is applied from the backend when static? Less memory-intensive for the browser.

Difference between language (2-letter code) and locale (4-letter code).

#### Formatting

Forms

## Styling

Avoid conflicts. Different approaches: modules, OOCSS, etc. CSS-in-JS vs precompiler, etc.

Complete isolation is the best. Using random classes like CSS-in-JS is likely the easiest. It does not rely on the understanding and application of a standard.

### CSS units

Px vs em, etc.
Layout units.

### Layout type

Float, flex, grid.

### Positioning

Absolute, fixed.

### Portals

Inject a floating element inside body vs parent elements.

### Overflow

Hidden, static, auto.

## UI & UX

### What should be provided to programmers

### Responsive design

Responsive design is the practice of building interfaces that adapt to a device's specificities, in particular its size, input method (touch or mouse), sensors (location, inclination, etc.) or more generally any supported feature. Most commonly, it refers to the capacity of an app to work well on a smartphone or tablet, in addition to computers.

Whether mobile is a priority or not, the Platform should be designed to be fully responsive. Apps may decide to invest or not in testing on different devices, but it would be naive to decide that our Platform as a whole does not need to take it into account. Responsive components are one of those things that may be very difficult to engineer back into an existing design without causing breaking changes.

The good news is that creating responsive components is far from being that complex.

#### Responsive layout

The basis of responsive layout is that if elements are positioned horizontally on larger screen sizes, they will cascade one under the other when we deem the space insufficient.

A common technique to create responsive layouts is called media queries. Media queries are a CSS feature that allows specifying styles that apply only under certain conditions. There is a large number of conditions that can be watched, and the number increases on more recent browsers supporting the latest CSS specs, but the most commonly used remains the screen width. By using predefined widths representing our various devices (our Breakpoints), we can modify the design for those devices. It's worth noting that the design will in fact also adapt itself when scaling the app down on larger devices when the browser is scaled down, for example when you resize your browser window on a laptop. I have experienced projects where it was mandated that the responsive version should not be accessible on desktop at all, but I would argue that doing so adds very little value and costs a lot more, so I would strongly discourage this approach.

When it comes to responsive layout, media queries still have their limitations. When building a responsive component, we usually know what is the minimum reasonable size for it (for example, a standard input should not be smaller than 200px), but we do not know in which context it will be used. If the container in which the component is used has some padding, or for any reason does not take the full width of the screen, using media queries will not reflect our intent. In those cases I encourage constraint-based responsive layout. You can use the Plateau FlexRow standard as a model.

It remains that media queries are essential to certain aspects of our responsive design. For example, changing the font size on smaller devices, or even adapting the margin or padding, cannot be done with constraint-based layout. So media queries remain an important part of building responsive layouts.

I will finish by addressing JavaScript-based responsiveness. It is absolutely possible to use JavaScript to customize our application and, while I would not entirely discard it, it needs to be introduced with some caveats. It implies using a 'resize' listener. This listener is triggered in quick succession when the browser window is resized, or usually, when device orientation is changed. The important rules I would recommend are:

- Don't do anything using JavaScript that can be done in CSS.
- Always use a single resize handler, even if many components need to watch the resizing.
- Always rate-limit the resize logic (debounce or throttle).
- If your logic touches the DOM, request an animation frame.

#### Accessing the breakpoint from JavaScript

There are some valid cases for needing to know the current breakpoint from JavaScript. The most efficient way to watch a media query is via the MediaQueryList API. This API is widely supported and should be usable in your Platform. The Plateau Breakpoint standard offers a way to watch our pre-defined breakpoints.

#### Watching an element's size

Watching a specific container's size is usually much less suitable. There is no easy way to get notified when an element changes size. To do so, we would have to rely on watching the window resize event and ask for the new element size at each iteration. It also does not cover the case where an element is resized without a window resize event being triggered (let's say an element is expanded, collapsed, hidden or displayed). Measuring an element's layout is a slow process (layout thrashing, see rendering) that should be avoided when possible, and this technique should remain a last resort.

This is changing thanks to the new ResizeObserver browser API. This API provides an efficient way of watching an element's size and may open the path to new techniques in our shared components. Unfortunately, it is not available on older browsers like Internet Explorer (any version), or even older versions of common browsers. A polyfill can partially replace its API, but it'll suffer from the same performance issues (as it will rely on a resize handler). So my recommendation would be to avoid using ResizeObserver altogether in your Platform for now, unless you have a very strong commitment at the highest level that only evergreen browsers are supported (my experience encourages me to take these kinds of assurances with a pinch of salt). Support inside a specific app is totally fine, although the same recommendations listed above remain valid.

[Example of something that cannot be used without ResizeObserver].

Reference: https://web.dev/resize-observer/

#### Touch friendliness

### Grid

A grid is a technique to improve the flow of a page. If not required, it remains highly recommended. A common number of columns is 12, but other numbers are sometimes seen, for example 24.

The number of columns has a strong impact on the design of shared components and layout in general, and the benefit of customizing it is small to none. Even if your implementation allows customizing the number of columns, the grid tends to permeate our components deeply and it may require a large amount of effort to keep supporting it, and especially testing it. I would therefore recommend fixing the number of columns at the Platform level and not allowing it to be customized.

The Plateau Grid Standard is by default 12 columns that can be configured.

### Units

It is recommended to use measurements in certain predefined units. A common unit is 4, so measures would go by 4, 8, 12, 16, 20, 24, etc. From a certain point, maybe beyond 24, we could go by jumps of 8, and later, beyond 64, by jumps of 16, etc. Those sizes should be applied to fixed-size dimensions (width and height) as well as spacing (margin and padding).

The idea of using those units is to establish a visual "rhythm" where elements align themselves with regularity. We want, for example, to avoid having a 19px-wide element next to a 22px-wide element. Such discrepancies tend to attract the eye, even subconsciously, and reduce our appreciation of a design.

It is possible to always define sizes in our app using a multiplication of our base unit (width: ${unit * 4}px) but I believe that the cost would in this case outweigh the benefit. I don't see any strong reason to let an app configure its units. Always using variables is tedious and a practice likely to be given up sooner or later.

To encourage the adoption of our unit, I would mostly rely on education and secondarily on utilities. As previously mentioned, measurements are too commonly used to force the use of variables every time. As a simple rule to learn, code review can go a long way in enforcing such a standard. A mature Platform would also provide most structural components, so apps would rarely have enough reason to define their own dimensions.

Common structural components would also benefit from offering a simple way to modify spacing (margin and padding). Plateau offers the Spacing standard.

m={8} p-xs={24}.... Etc.
The spacing standard can enforce respect of our standard with a configurable level of strictness (e.g. info, warning, error, etc.), but contrary to using a unit in CSS, using this helper is easier and the enforcement transparent, so we have the best of both worlds.

The ideal Platform might also benefit from having an automated analysis tool that identifies measurements not matching our units and flags them with a warning. This analysis would be available on our App dashboard, Platform dashboard and at the PR dashboard. We would also consider an in-code code-standard warning or info message, to give immediate guidance to the developer.

### Breakpoints

Breakpoints are standardized measurements used to adapt the interface of our apps. There is a strong de-facto standard to use the following breakpoints: xs, sm, md, lg, xl. The exact size for each breakpoint for your Platform may change depending on your needs, but I would recommend adopting well-known breakpoints from an existing framework. There is little benefit to having your team spend time debating what the breakpoints should be. For the same reason, standard breakpoints should be provided as part of your Platform.

Example of an existing breakpoint standard:
Bootstrap

From a technical point of view, I would consider the ability to configure the breakpoints in the Platform as a requirement. Breakpoints should be allowed to evolve with time, so new breakpoints should be allowed to be added, existing breakpoints should be able to be removed, and measurements for them should be configurable. The same should be true from within a specific app. Although it would not be recommended for any app to refine their breakpoints, it is not excluded that an app with special needs may have to do so. White labelling would certainly be a good reason to change breakpoints, or maybe a special app targeting televisions or other unconventional devices.

## Component Oriented Design

One of the most critical aspects of a successful platform.

### Browser rendering

Layouts, life cycle, requestAnimationFrame.

Layout thrashing if you don't take care to batch all your reads and all your writes. (https://web.dev/resize-observer/)

### Loading & waiting

Loader, progress bar, skeleton. Avoid flickering.

A loader should not be allowed to flicker. The recommended technique is to only show the loader past a threshold (e.g. 50ms) and for a minimum duration (100ms). Duration to be validated using a test. Expose a tool to determine it. This behavior should be the default, but also configurable.

Most of the time on the web, it is not possible to know the time required for an operation. So we have to use unspecific loaders (there must be a term to describe loaders that do not have a length). Two common variants exist: loaders and skeletons. Loaders represent an animation of different kinds, for example the very common spinner. The skeleton represents the content that will (or may) eventually be loaded. It provides the user with an expectation of the nature of the content being loaded, as well as limiting layout changes. The skeleton is preferably slightly animated to indicate the work being done by the application.

If the loading exceeds a certain amount of time (pre-established by the Platform), a message should be shown to warn the user.

A timeout value has to be set by default, but should be configurable. Short operations have no point running for multiple minutes. Long operations (like an upload) will have an increased timeout.

Ideally, long operations will be handled in an async way. Define a standard duration in your Platform after which it is recommended to take the task async. A status bar must stay present but the user is allowed to navigate away from the page. This works well unless the upload is part of a longer flow. A window alert should be shown if the user tries to close the window or navigate away from the app.

When uploading or downloading a file, it is possible to know the progress of the upload. This allows us to display a real progress bar. It does not include the processing time on the server. The best way would be to end the request once the upload is complete and do the treatment async on the backend. If not possible, a loader could always be shown after the progress bar, but it's far from perfect. Avoid having the progress bar stuck at 100%. You may also want to consider starting the progress bar not at 0%, but always showing a small bar. This may be less frustrating if the progress is slow to start. Multiple uploads should be sent independently, in parallel. Avoid sequence. An error should not stop the whole transfer, unless they are dependent. Individual operations should be retryable individually.

Upload in general. Best practices. Iframe, ajax, memory impact?

Example of loaders (spinner, animated, etc.) and skeleton.

Notifications

- Toasts, snackbar, popup.
- Dismissable, auto-dismissable.
- Multi actions.
- Level of importance.
- Seeing previous notifications.
- Blocking vs non-blocking

Messages

- Tone.
- Level of importance.
- In place or not (modal).
- Possible actions.
- Blocking (needs confirmation)

Bootstrapping
Initial loading

Shortest time to display.

FOUC, web fonts.

Unsupported feature, navigator.

### Selecting

#### Native vs custom selects

### Searching

### Quick actions & action bar

### Browser, device & feature detection

Which approach to follow, when to use a library.

### Browser APIs

Localisation, storage, etc.

Progressive Apps (PWA)

Not fond of the branding, just a marketing term for a bunch of features.

- Installable.
- Offline use.

Inputs
Placeholder, mask, icon, clear button.

### Shortcuts

For more advanced apps, use a library. Balance with size. Load just what is needed? Ideally, semantically declared by scope, so they can be automatically documented by a tool.

### Charts

A perfect example of where a tool would make more sense than a lib. Extremely complex and feature-rich, so any lib would become very large. A tool would make creating charts much simpler, and could expose the absolute minimum code. Settings would ideally be saved in a tool-agnostic, standard-based JSON file. Tools could then be compared for their support of the standard and which features they support, the appearance with each tool, the size it produces, the capacity to style, etc.

### Documenting

Prefer tools that extract information from the code itself. The ideal solution would be an AI tool that would understand the code enough to summarize it in plain language. This is what the Platform should tend toward. For now, we still have to help by being consistent and following predefined patterns.

Docs as close as possible to the code.

Everything in markdown.

Doc coverage. Would it be possible to have a tool automatically expose what has been documented.

## Plateau Standards

### Spacing Standard

### Grid Standard

### FlexRow Standard

### Breakpoint Standard

Which breakpoints, configurable, default size. API to access the breakpoint from JavaScript (MediaQueryList).

### Changelog Standard

Format for human readability. API for libs describing which files have changed and the nature of each change (major, minor, patch).

### Granular Import Standard

How to structure a lib so that different files can be imported with named imports without loading everything. Determine what is public and what is not. How to abstract file paths, for tests for example, so that no app relies on the specific location of a file. Warning when using a specific path in your app.

### Private module Standard

Starts with #, not exposed using named imports.

### Nomenclature Standard

File name. Offer multiple choices, highly configurable, with a default. Configure the strictness with which it is enforced within the project or libs.

Extensions
Using a special extension to identify the nature of some files.

Examples:
- MyComponent.ts
- MyComponent.constants.ts
- MyComponent.actions.ts
- MyComponent.test.ts

Casing

Capitalization
- lowercase
- UPPERCASE
- CamelCase
- lowerCamelCase

Separator
- Snake: _
- Kebab: -

Types:
- Constants
- Class
- Components

Context:
- File Name
- Variable name
- Special directories

Examples:
- __mocks__
- __tests__

### Mock Standard

### Global State Standard

### Action Standard

### Module Manifest Standard

Describe the dependencies for a module to be dynamically loaded.

## Plateau Services

- Env variables, including dynamic
- Build
- Dev service (http2)
- Prod server.
- Module-as-a-service provider
- Lib with basic APIs.
- Logging
- Tracking

Meta-framework:
- Actions
- State
- Top-level routing
- Mocks, proxy

## Analysis

- Outdated
- Large files
- Code format
- Complexity
- Compatibility with latest Platform standards & libs
- Tests pass or not
- Component usages, especially shared components
- Dependency analysis, duplication, percentage of usage (during tests).
- APIs used
- Security
- Routes, what connects to what

## Monitoring

- Live or not
- Pass tests
- Usages
- Live external links and validate content does not change.
- A / B testing
- Feature toggle
- Online code editor

Generator management
- Create app
- Create page

## Development Tools

### Browser Dev Tools

### Wireshark & equivalent

### Platform Tools

#### Analyzers

Outdated

#### Generators

#### Editors

It's the next step after generators. Where generators are only useful to create new files, editors allow a quicker update to existing files. There can also be integration restrictions, examples, documentation, that a standard editor cannot.

Examples of editors:
- Edit environment variables. Explanation of the standard, warning if it is not followed. Creation of new environments. Temporary deactivation? Visualisation of the combined variables for an environment. Identification of static and dynamic variables.
- Actions. Add an action. See where it is called, visualize scopes.
- Scopes. Add / remove a scope. Edit default state. See where scope state is used.

## Dashboard

Essential to visualize every app in the Platform.

Health rating as an easy-to-identify combination of every measure. Points are given to each measure according to preference.

- Test coverage
- Screenshot diff
- Outdated
- Adherence to each standard.
- File size.
- Ts vs js
- Code format, including exceptions.
- Eventually, complexity in comparison to business requirements. In other words, it would be great to compare how complex different apps are to arrive at the same result.

## About WebAssembly

Be careful about anything encouraging the adoption of diverging practices. No UI, unless canvas. Issue of accessibility. A great tool for some apps, but not our Platform. It can be used in the implementation to accelerate the code, but does not play in the same arena as the Platform. Apps should be careful before using WebAssembly. The cost of adding a new language and a totally different layer should only be considered if the benefits are worth it. Great for frameworks, great for high-computation apps (games, visualisation, etc.). Again, those are not the aspects the Platform should address.

## The frameworkless future

Standard based, interface based. Web standard. Platform based.

## The evergreen app

The Holy Grail — maybe impossible, but still something I hope we will try to achieve.

Requirement-as-code that the Platform AI can understand. In plain language, but with a BDD-like format. Using a special editor to make it easier. Problems, like contradiction, ambiguity or missing requirements, can be identified by the AI.

Code is written by developers, but as we use low-level, very mature APIs, the layer specific to the app is limited. We use an always-increasing number of Web APIs, in addition to a public Platform API, and a private set of Platform APIs. These are loaded as MAS — only those needed are loaded, and always just before being needed for the first time.

Server side rendering is automatic thanks to the Platform infrastructure. It also integrates logging, tracking management, A / B testing, translation, theming, etc.

The AI is able to automatically test a large part of the requirements. Those are identified and marked as tested and tracked. Others cannot be, and must be coded by a dev, or the AI must be shown how to test them — this way the AI constantly learns how to test new requirements. With time, a larger and larger number of requirements can be automatically tested.

Monitoring is always in place. Protocols control what should be done, and who should be notified. The console permits a granular analysis of any incident, and reverting to a previous version if needed. Parts of the app can be closed off, manually or automatically, without a deployment.

When a new version of a dependency is available, third party or internal, a security analysis is run. Certain rules may be set, like a buffer period before a new library is used. The new dependency is then updated in a branch and tested automatically. If it passes, it may be merged and deployed automatically, or with the approval of a developer. If an update is needed, standardized migration scripts included in the lib allow many breaking changes to be handled automatically. A changelog manifest documents, for each file / module, the nature of the change (major, minor, patch).

Changes to the Platform standard are also, in the vast majority of cases, accompanied by scripts that may proceed with the migration automatically. Again, the update will go through testing and any gates before being merged.

This approach will keep apps running with the latest version and practices across the Platform, and also means that micro-apps will stay compatible among themselves and will be able to be loaded as pages of a single macro-app.

If an app, for one reason or another, does not get updated, it still stays usable. In the worst case, it will not be compatible with the latest app shell and will have to run with an older app shell. This will be tagged in the dashboard so it is raised to attention. The points that make it incompatible will be highlighted so that an intervention can be planned, if deemed necessary.

When developing new features, it will first start by updating the requirements, thus making it fail. If automated tests can test the new requirement, then the change can be applied. Otherwise, tests will need to be added or learned by the test AI. The change is then coded.

Eventually, code could be changed automatically from the requirement directly. Two possibilities: the only source of truth is the requirement, from which the code is generated at run time or build time. Not impossible, but a very high level of confidence would be necessary. A more likely situation would be a proposed code change / generation from the requirement, that would then be validated or modified by an integrator or developer. We can generate an increasing number of requirements via patterns learned by our Platform AI.

## References

- Caniuse.com
- W3C standards
- MDN
- Contrast checker.
