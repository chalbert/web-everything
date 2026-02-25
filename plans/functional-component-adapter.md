I'd like to start to work on a cross project feature.

First, I like to start building a basic functional component adapter. It would allow to define a Web Component as a functionnal component, similar to React's, that will be compiled to a standard Web Component according to strict rules. The spec should be WE, the adapter in FU. In Plateau, I'd like to start working on a Module-as-a-service provider that will allow serving a component in either it's original Web Component form or in functional component - with many other params eventually (language, transpile target, a/b test, etc.). Could also adapt from functional component source to web component. Ideally Plateau should not reinvent the wheel but leverage existing service infrastructure.

First version can be very simple, just a simple render.

Next we should work on adding callbacks, effects, change detection.

Change detection is probably a while subject in itself that will require deep research. The goal being to provide flexible, injected implementation of change detection that could cover every approach in the market - not a single way of doing things. Close link with web context, web store - might be part of the web store project. I'm thinking of a customChangeDetectorRegistry or something like it. 

