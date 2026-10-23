# Foldkit Conventions

Foldkit owns this file. `create-foldkit-app` writes it and upgrades replace it whole, so anything added here is lost. Project-specific instructions go in `AGENTS.md`.

This is a Foldkit app, a framework built on Effect-TS, architected like Elm.

## Getting the canonical references

The live Foldkit code is the canonical reference for everything: which APIs exist, what idiomatic apps look like, what the current conventions are. Written docs (including this one) can drift; the code can't.

If `./repos/foldkit` exists, it contains the full Foldkit repository, vendored in as a git subtree. Read from it directly:

- `repos/foldkit/examples/`: runnable example apps spanning every complexity tier. Usually your first stop when looking for a precedent for how to write something.
- `repos/foldkit/packages/foldkit/src/`: framework source. Ground truth for API signatures.
- `repos/foldkit/packages/typing-game/client/src/` and `repos/foldkit/packages/website/src/`: production apps built with Foldkit. Highest-fidelity reference for application architecture, Blocks, and OutMessage.

Treat the subtree as read-only reference: never import from `repos/foldkit/` in your project source. Imports must come from the `foldkit` npm package.

If `./repos/foldkit` does not exist and `AGENTS.md` says `subtree_prompted: false`, offer to vendor the repository. It gives you access to the full source, examples, and docs. Pin it to the release git tag matching the installed `foldkit` package; vendoring `main` instead can hand you examples and APIs from a release the project has not installed:

```sh
git subtree add --prefix=repos/foldkit https://github.com/foldkit/foldkit.git "foldkit@$(node -p "require('./node_modules/foldkit/package.json').version")" --squash
```

A canary install has no release tag to pin to. Its version names its source commit (`0.156.0-canary.<commit>`); use the full hash of that commit as the ref instead. GitHub expands the short hash at `https://github.com/foldkit/foldkit/commit/<commit>`.

Whether the user accepts or declines, set that line in `AGENTS.md` to `true` so it isn't asked again.

If `foldkit-skills` is installed as a Claude Code plugin, the `generate-program` and `audit-program` skills carry snapshot architecture and conventions guides synced from the live code.

## After a Foldkit upgrade

Two things go stale when the project upgrades its Foldkit packages: the vendored subtree and this file. Bring both forward, subtree first, since the fresh copy of this file comes from it.

Re-pin the subtree to the newly installed release (for a canary install, pin to the commit its version names, as above):

```sh
git subtree pull --prefix=repos/foldkit https://github.com/foldkit/foldkit.git "foldkit@$(node -p "require('./node_modules/foldkit/package.json').version")" --squash
```

Then replace this file whole. Foldkit's conventions change with its APIs, and a stale copy sends agents after APIs the installed packages no longer export. Copy `repos/foldkit/packages/create-foldkit-app/templates/base/FOLDKIT.md` over this file. Without the subtree, take the template from GitHub at the tag matching the installed version: `https://github.com/foldkit/foldkit/blob/foldkit@<version>/packages/create-foldkit-app/templates/base/FOLDKIT.md`. There is nothing here to merge or preserve.

## Project Conventions

- Name a concrete typed Block authoring value `<BlockId>Definition`, such as `SearchDefinition = Block.makeDefinition('Search', ...)` and `ApplicationDefinition = Block.makeDefinition('Application', ...)`. Keep the runtime ID unchanged. Name the corresponding Composition `<BlockId>Composition` or `ApplicationComposition`. Export ordinary completed values as `SearchBlock` and `ApplicationBlock`; a generic factory returns an exact completed Block that its caller names locally.
- Foldkit is tightly coupled to the Effect ecosystem. Do not suggest solutions outside of Effect-TS.
- Model fields must be Schema types (the model is a schema). Plain TypeScript types are fine elsewhere (function return types, local variables, etc.).
- Use full names like `Message` (not `Msg`), and `withReturnType` (not `as const` or type casting).
- Declare every variant together: `defineMessageUnion()` for Messages, `defineTaggedUnion()` for other domain unions, and `defineRouteUnion()` for Routes.
- Keep constructors on their union: `Message.ClickedSubmit()`, `FetchState.Ok({ data })`, and `ApplicationRoute.Home()`.
- Use `taggedStruct()` only when the variants cannot be declared together, such as a recursive union.
- Push back on any direction that violates Elm Architecture principles: unidirectional data flow, messages as facts (not commands), model as single source of truth, side effects confined to commands. If a prompt suggests mutating state, imperative event handlers, or two-way bindings, flag the issue and propose the idiomatic Foldkit approach.
- Never use `NoOp`. Every message must describe what happened. A command's result message is named from the command, not from the fact it reports, whether or not it carries a payload: `LockScroll` → `CompletedLockScroll`, `DetermineStartTime` → `CompletedDetermineStartTime` (never `DeterminedStartTime`).

## Foldkit Patterns

### Update

Author init and update through the same named Composition used for view and completion. Its update callback receives the locally authored Message. Registered child Bindings route generated envelopes before that callback. Contextual typing supplies Model and Message types and preserves inferred Command requirements:

```ts
const update = ApplicationComposition.makeUpdate((model, message) =>
  Message.match(message, {
    ClickedIncrement: () => ({
      model: modifyFields(model, { count: count => count + 1 }),
    }),
  }),
)
```

Keep purposeful parameter types for additional operation inputs and dispatch context. Avoid repeating Model, Message, or return annotations already established by owned helpers. Standalone utilities remain module functions such as `Update.combineSteps` and `Command.mapMessages`.

An authored update supports `update(model, message, ...context)` for Runtime dispatch and `update(message)(model, ...context)` as an internal Step. Put the local Message constructor directly under `operations` when its payload is the public input, such as `operations: { requestClose: Message.RequestedClose }`. Completion associates it with the Block update without constructing a Message. A constructor with payload fields takes one constructor payload object followed by the update context, with constructor defaults honored; a constructor without payload fields takes no payload placeholder. Use a tuple producer under `operations` when the public inputs need mapping, refinement, defaults, or an exact context tuple. The completed Block or Binding passes the resulting Message through update synchronously as part of the pure transition; it does not enqueue another Runtime Message. Keep standalone Steps for internal Model transformations. `Update.combineSteps` accepts unary Steps, so add an explicit unary adapter that supplies every required context argument before combining a contextual update.

Name Binding actions as `requestCloseMenu` paired with `Message.RequestedCloseMenu`, and notifications as `informJoined` paired with `Message.InformedOfJoin`. Both enter child update; do not expose silent Model-changing helpers.

Each completed operation returns the completed update function's full return contract. If one update branch returns a Command or OutMessage, every operation carries that requirement or optional result in its type even when its own Message reaches a pure branch. Calling a pure operation does not run effects from another branch.

Update, init, Step, and component helper producers return `{ model }` when they statically create no Commands. When they compute a Commands collection, return it directly without checking whether it is empty. Never write the literal `commands: []`; `foldkit/no-empty-commands-array` enforces this producer convention.

Use `Array.filter(commands, () => condition)` for a Boolean-conditioned Command group and `Array.filter([command], () => condition)` for a singleton. Keep `Array.liftPredicate` only when its predicate meaningfully examines each Command. Do not route a Boolean condition through `Option.liftPredicate` and `Option.toArray`; actual optional absence still uses `Option`.

`FeatureComposition.makeInit(fn)` authors a startup plan. Return only parent-owned fields under `model`; registered Binding `init` policies supply their child fields. Supply ephemeral `childInitContext` only when selectors need shared context for direct child initializer arguments. Optional parent `commands` precede retained child init Commands in Binding order; `steps` run afterward against the assembled Model and append their Commands in order. These are pure transitions, not an extra Runtime phase. Give the initializer one concrete signature; optional, default and rest parameters remain exact. Completion checks Flags, routing, handler completeness and registration evidence. Declare meaningful startup operations such as `requestLoadInitialData`, `requestRestore`, or `requestOpen` as Message producers and invoke them through the Binding in the plan's `steps`. Do not manufacture a separate startup-only Message when an existing Message already records the transition.

When composing an update-like result that already contains a Model and optional Commands or OutMessage, bind the whole result to a value named after the operation and access its fields through that value. Use `homeInit`, `dialogClose`, or a trailing underscore such as `init_` when the operation name collides with the function. Do not destructure or rename `model`, `commands`, or `outMessage`. Dot access does not prevent someone from ignoring `outMessage`; it keeps the operation and all of its returned fields visible together. Name a child fold's `write` parameter after the next child Model, such as `nextSettings`.

Pass optional Commands directly to APIs that accept them: `Command.mapMessages(homeInit.commands, toMessage)`. Use `result.commands ?? []` only when the next operation requires a concrete array for spreading, concatenating, execution, or an assertion.

Use `Update.Return<Model, Message>` when an update cannot emit an OutMessage. It prevents a result containing an OutMessage from entering code that would keep only its Model and Commands. A result with no `outMessage` can still be used where `Update.ReturnWithOutMessage<Model, Message, OutMessage>` is expected. The missing field means that update emitted no OutMessage.

Author every ordinary child through `const ChildDefinition = Block.makeDefinition('Child', { Model, Message, OutMessage? })` and create `ChildComposition = ChildDefinition.makeComposition({ bindings?, mounts? })`. Return `ChildComposition.prepareBlock(...)` from one private zero-argument `prepare` producer, then put the checked `ChildBlock: Block.FromAssemblyWith*<typeof Model, typeof prepare> = Block.assemble(prepare)` export immediately after it with no blank line. Choose the matching one of the four view and OutMessage shapes. `prepareBlock` returns an opaque draft with no Model or runtime methods; `Block.assemble` returns the completed Block accepted by Bindings, Programs, and Server rendering. This Definition → Composition → preparation → assembly sequence is passive; only the Runtime starts the resulting program. The feature barrel exports only `ChildBlock`; reusable Schemas and pure utilities use an explicit domain barrel. The parent imports the completed Block and creates `const ChildBinding = ParentDefinition.makeBinding(ChildBlock, config)`, then includes the Binding in its Composition's `bindings`. The Binding projects `init`, `fold`, the operations selected in the Block's `operations` record as direct named methods, and `embedView`, so the parent declares the relationship once. Composition carries lifecycle registrations and handler Layers without placing internal metadata on the ordinary Binding surface.

The authored parent `Message` contains only local facts. `FeatureComposition.Message` and the completed `FeatureBlock.Message` are the complete dispatch Schemas and include generated child envelopes. Query a cross-module dispatch type directly from one of those complete contracts, such as `typeof FeatureBlock.Message.Type`, instead of maintaining a second authored union or a routine alias.

Binding folds and Binding-projected operations are connected Steps whose Model input requires the exact registered graph. A typed call with a raw Model fails. Return or compose the opaque result intact from `Composition.makeUpdate` or `Composition.makeInit`; it has no public `.model` or `.commands` before checked execution. The raw recipe exposes only its direct channels. The owning Composition resolves registered policy into the final parent Command Message, requirements, and OutMessage channels, so derive exported parent contracts from the Composition-authored update or completed Block. A completed `ChildBlock.operations.operation(model, ...args)` dispatches its produced Message through the Block's update, accepts the raw Block Model, and returns the readable executed result. Ordinary pure Steps remain directly callable. TypeScript may accept a connected Binding function as a method returning `void`; outside the graph, that call only creates and discards passive configuration and executes no child work.

For an exact parent Struct field storing `ChildModel` or `Option<ChildModel>`, use `field`. `None` makes the child absent; folds and operations never create it. `presentWhen` gates the whole direct child without deleting stored state. `subscriptions.when` gates only Streams. The Composition generates child delivery envelopes; do not add a child wrapper to the authored parent Message or write Message mappers.

A direct array of child Models uses `field` and a string-valued `key` naming a stable child field. The child Schema must expose declared Struct fields. Init and child transitions preserve the key; parent update owns membership. Wrapped rows use `field`, `key`, and `childField`; union or opaque child Schemas without declared fields and custom parent writes retain general keyed accessors. A general keyed Binding provides `readAll`, function-valued `key`, exact `keySchema`, `read`, and `writeAt`. Tagged parent Models and writes that derive other parent state retain `read` and `write`. Put admission policy in `delivery.when` and derive required child update context with `delivery.toUpdateContext`; keyed callbacks receive the occurrence key. Placement identifies one Binding within the parent composition graph, not a DOM position or necessarily a Model field. An unkeyed direct field Binding defaults placement to `field`. Every keyed form, including direct and wrapped arrays, defaults placement to the child Block ID, as do static accessor Bindings. A keyed `key` identifies a dynamic occurrence under that placement. Optionality needs no override. Supply an explicit placement only when sibling defaults collide or a deliberate stable graph identity differs from the default.

Use `Update.combineSteps` when a later Step should receive the Model produced by an earlier Step. It takes two or more Steps. Do not wrap one Step in `Update.combineSteps`; call that operation directly. Name an inline Step parameter `stepModel`; it contains the Model produced by the preceding Step.

When the OutMessage is already known while constructing a new result, include it directly: `{ model, commands, outMessage }`. Use `Update.withOutMessage` when attaching an OutMessage to an existing plain return or when the value has the type `OutMessage | undefined`. Pipe an existing return into the helper: `pipe(dialogClose, Update.withOutMessage(outMessage))`. When constructing the plain return in the same expression, pass it first: `Update.withOutMessage({ model, commands }, outMessage)`.

Add `outMessage.forward` only when at least one child OutMessage should continue to the current Block's parent. For partial forwarding, match every child variant and return `undefined` for the variants that stop here. Omit `outMessage.forward` when every variant stops here. `outMessage.fold` still handles each variant locally, including variants that continue upward. Never write `outMessage.forward: () => undefined`.

Bind a standalone `fold<Child>OutMessage` directly to the child union's
exhaustive matcher when it needs only the OutMessage. Name every variant, even
when the union has one variant. Use the same direct matcher form for a
`outMessage.forward` mapper that needs only the OutMessage. Keep a function or
factory around the matcher when its branches consume other per-dispatch
context, including a collection key, previous Model state, an entry payload,
or `FoldContext` lifters. For a generic child with a structurally refined
OutMessage payload, pass the refined type as the matcher's second generic. Let
`FeatureDefinition.makeStep` preserve Command requirements from Command-producing
branches instead of constraining the matcher to a requirement-free
`Update.Step`.

Use `FeatureDefinition.makeFieldsStep(callback)` for an actual unary Model-only
field Step. The callback returns only field transformers. Use
`FeatureDefinition.makeNoopStep()` when a named child OutMessage intentionally
preserves the parent Model. Use `FeatureDefinition.makeCommandsStep(commands)`
when a composed Step only returns an existing Command collection. Use
`FeatureDefinition.makeOutMessageStep(outMessage)` when a Step preserves the
Model and emits one already-known declared OutMessage; this helper is available
only on Definitions that declare an OutMessage Schema. Keep
`FeatureDefinition.makeStep` for additional arguments, Model-dependent Commands
or OutMessages, connected Binding, initialization, delegated, conditional, and
composed results. `Update.combineSteps` rejects OutMessage-producing Steps;
attach an OutMessage to its result with `Update.withOutMessage`. Keep ordinary
update branches as ordinary returns instead of constructing and immediately
invoking a Step.

For a child stored in an exact required direct field, omit `init` when its initializer accepts no arguments. The Composition initializes it automatically. Use `init: { contextToArgs }` for required inputs, or `init: false` when the parent supplies that required field in the init plan's `model`. Optional, keyed, and accessor storage remains parent-owned when `init` is omitted; explicit `init.contextToArgs`, `init.instances`, or a checked custom projection chooses automatic startup. For an Option field, `contextToArgs` returns `Option<tuple>` and `None` leaves the child absent. An optional `ChildInitContext` Schema on the parent Definition contextually types selectors that share context for direct child initializer arguments, and the Composition init plan carries the decoded value as `childInitContext` when a selector uses it. It does not describe the current Block's own init arguments. Ordinary tuple literals retain the child's exact init argument types. A custom accessor can use `init: { contextToArgs, toParentFields }` to project the exact initialized child into one declared parent field. Direct and wrapped keyed arrays use `init.instances` returning ordered `{ key, args }` records and `init.toItem(occurrence, childModel)`. Preserve the planned key and the exact initialized child object; a wrapper literal can retain parent-owned metadata. General keyed accessors retain explicit occurrence creation through named parent Steps.

Composition invokes selected child initializers once, assembles their fields with parent-owned fields, then applies the plan's Steps. It filters child init Commands when their occurrence is absent or `presentWhen` is false, preserving remove-and-readd generation isolation. `subscriptions.when` gates only Subscription Streams. Runtime executes collected Commands later; their collection order does not sequence asynchronous completion. Keep `Binding.init` for deliberate creation or replacement of an occurrence during an update. It returns a passive, noncallable recipe with no `.model` or `.commands`. Return it intact from `Composition.makeInit` or `Composition.makeUpdate`, or preserve it through a Definition-owned `makeStep`. The Composition callbacks interpret it directly.

`FeatureComposition.makeUpdate(fn)` handles the locally authored Message after registered Bindings route generated child envelopes. Use `delivery.when` to reject inactive occurrences and `delivery.toUpdateContext` to derive the exact child update context from the parent Model and occurrence key. A custom keyed Binding supplies `keySchema` as its serialized identity contract. A child whose Message Schema is `Schema.Never` needs no delivery policy. Use `FeatureComposition.makeUpdate()` when the feature has no locally authored Message variants.

Use `modifyFields()` from `foldkit/struct` for immutable model updates. Never spread or `Object.assign`.

### View

Every view receives `h`, the typed Html builder, as its last parameter. Define the canonical completed view through its owning Composition's `makeView` or `makeView.withInputs`. A completed Block's `makeView` method authors only an alternate embed view against its already fixed graph. Ordinary extracted helpers are plain functions. After establishing `FeatureComposition`, declare `type FeatureViewBuilder = Block.ViewBuilderFor<typeof FeatureComposition>` on the next line with no blank line and use that alias for feature-local helpers. Export it only when another file uses it. It retains the feature Message type and registered child and Mount capabilities without constructing a runtime builder. The owner prefix is deliberate even though internal structural contracts remain `Model`, `Message`, and `OutMessage`: the completed `FeatureBlock` owns those public contracts, while the builder alias identifies one Composition's capabilities at a plain type import site. Give each helper only the Model, domain value, or context parameters it actually reads, followed by `h`; let TypeScript infer whether it returns one `Html` value or an array. Rendering genuinely shared across owners takes the framework's general `HtmlBuilder<Message>` form, with capability requirements when needed. Never annotate the primary view's inferred `h` parameter. Never construct a builder; reach for `h.div`, `h.OnClick`, and other helpers from the parameter. Only where no builder is in scope, typically module scope, use `inertHtml` from `foldkit/html`, aliased `ih`. Use `h.empty` (not `null`) for conditional rendering, the union's own exhaustive `match` for discriminated unions, and `Array.match` for lists that may be empty.

Keys are for mapped list items only: key each row by a stable Model identifier (`h.keyed('li')(item.id, [], [...])`), never by array position, and never derive a key from displayed data. Never key branches; the build gives each view function's output its own identity, so branch switches replace DOM automatically. When switching an inline same-tag ternary must reset DOM state, extract each arm into its own named view function.

Omit the children argument when an element has none: `h.div([h.Class('divider')])`, never `h.div([h.Class('divider')], [])`. The same holds for `keyed`: `h.keyed('li')(key, [attrs])`, never `h.keyed('li')(key, [attrs], [])`. Attributes stay required on element builders, so `h.div([])` is an element with neither. Sibling elements that end up at different arities are expected and fine; void elements like `h.img` have always read that way.

### Commands

Define a Command with `FeatureDefinition.makeCommand(name, { args, messages, handler })`; omit `args` when it takes none. Assign definitions to PascalCase constants. Keep the handler Layer beside its definition. Name the work the handler performs, not the later Model transition caused by its result: a timer that waits before update begins dismissal is `WaitBeforeDismissal`. Convert expected failures to result Messages with `Effect.catch(() => Effect.succeed(Message.FailedX(...)))`. Defects follow the application's crash handling. Commands belong beside the update that returns them.

Define a Command's identity, args, result Messages, and handler in its config. Set `handler` to a generator constructor; Foldkit applies `Effect.gen` internally, obtains stable dependencies, and returns the operation the Runtime invokes with update's args. Include `Definition.layer` in the feature's `EffectsLayer`. Return the operation directly from the generator when construction has no work to perform. The Runtime builds handler Layers once per application start; actual requests, delays, and DOM work happen inside the returned operation. Production and ordinary execution tests use the same handler Layer and provide different external Service Layers beneath it. Omit `handler` for a contract implemented by an external host; that definition exposes `toLayer` but has no `.layer`. `toLayer` accepts the host's implementation Effect constructor. Use it for a host implementation or an intentional alternative handler. Author update with `FeatureComposition.makeUpdate` to infer its Command requirements. Pass the feature's `EffectsLayer` to `FeatureComposition.prepareBlock`; `Block.assemble` carries that checked handler graph onto the completed Block. Complete the root as `ApplicationBlock`, create the host Program in `entry.ts`, and call `program.provide(ApplicationLayer)` to supply only its remaining ordinary Services.

Compose each attached handler recipe directly in the feature's local `EffectsLayer`. Create a standalone `<DefinitionName>Layer` binding only when that provider is intentionally public or independently reused, and name alternatives `<DefinitionName>TestLayer`. A small feature composes `EffectsLayer` in `block.ts`; a substantial feature uses `layer.ts`. `EffectsLayer` supplies declared Command, Subscription, Mount, and ManagedResource handlers. `ApplicationLayer` supplies the ordinary HTTP, storage, RPC, clock, browser, and other Services those handlers or startup Effects require. Keep root `ApplicationLayer` composition in `services.ts`; `entry.ts` imports it, supplies it to the Program, and starts the Program. Reserve `Layer` for the Effect module.

Every feature is a completed Block. When it uses Definition authoring members, create `const FeatureDefinition = Block.makeDefinition('Feature', { Model, Message, OutMessage? })`. A specialized generic factory instead creates `const FeatureNamespace = Block.makeNamespace('Feature')`, then calls `FeatureNamespace.makeDefinition({ Model, Message, OutMessage? })` for each typed contract. Ordinary split features with Definition authoring establish their contracts in an early `definition.ts` without importing their completed barrel. Author Commands, operations needed by Binding policy, Subscriptions and ManagedResources through `FeatureDefinition`. Author init, update and the primary view through the named Composition. Create child Bindings through `FeatureDefinition.makeBinding(...)`, then create `FeatureComposition = FeatureDefinition.makeComposition({ mounts?, bindings? })`; both fields are independently optional and default to empty. Author the canonical graph-aware view through the Composition and derive `FeatureViewBuilder` immediately after it when helpers need that alias. In `block.ts`, return `FeatureComposition.prepareBlock({ init, ... })` from the private `prepare` producer and finish the adjacent annotated `FeatureBlock` with `Block.assemble(prepare)`. The ordinary feature barrel exports only `FeatureBlock`; reusable Schemas and pure utilities use an explicit domain barrel. Parent modules import the completed Block, bind it through their own Definition, include the Binding under `bindings`, delegate through its fold and operations, and render with `h.block(binding.embedView(...))`. A generic factory returns the exact completed Block, which its caller names locally.

Keep `FeatureDefinition` only when code uses one of its authoring members. If its only use would be `makeComposition`, write `const FeatureComposition = Block.makeDefinition('Feature', { Model, Message }).makeComposition()` at module scope. In a split feature, put that declaration and its contract imports in `composition.ts` and remove the empty `definition.ts`. The expression still passes through Definition, Composition, and assembly as three passive stages. Keep the factory at module scope so the owner identity is created once.

Author the canonical `init` once through `FeatureComposition.makeInit(...)` and pass it to `prepareBlock` by shorthand. Do not wrap a raw Model-returning initializer inside assembly. A pure Model constructor may remain separate when domain code or fixtures use it directly.

Experimental Query and KeyedQuery values are completed viewless Blocks. Bind them with the same parent `makeBinding` method and include the Binding under `bindings`; use the Binding's `requestReset`, `requestRevalidation`, `requestRevalidationOrLoad`, and `requestLoadIfMissing` operations. The Query value itself retains direct `read` and `run` conveniences. Query preserves Fetch identity, handler completeness, host delegation, constructor errors and Service requirements, request generations, stale-response protection, and cache-key typing through standard Block composition. KeyedQuery entries are cache data inside one child Model, not keyed Block instances. A canonical Query supplies `query.EffectsLayer`; a host-owned Query omits `handler` and is completed with `query.provideHandlers(query.toLayer(...))` before binding.

Create the root with `Block.makeDefinition('Application', { Model, Message })`. Retain its typed result as `ApplicationDefinition` when root Commands, Mounts, resources, Bindings, or Steps use that value; otherwise chain it directly into the module-level `ApplicationComposition`. Create root child Bindings with `ApplicationDefinition.makeBinding(...)`, then establish `const ApplicationComposition = ApplicationDefinition.makeComposition({ bindings?, mounts? })`; use `makeComposition()` for a graphless root. Author `init`, `update`, and the primary view through `ApplicationComposition`; Definition retains early effect, Step and Binding authoring. Return `ApplicationComposition.prepareBlock({ init, ... })` with explicit implementation fields from the private `prepare` producer, then put the annotated `ApplicationBlock = Block.assemble(prepare)` export immediately after it with no blank line. `ApplicationLayer` contains ordinary HTTP, storage, RPC, clock, browser, and other Services only. The entry passes the completed Block, container, and startup inputs to `Program.make` or `Program.makeElement`, then supplies the Layer with `program.provide(ApplicationLayer)`. Tests and server entries import the passive Block without booting a browser Runtime.

The `make*` names identify factories. `makeInit`, `makeUpdate`, and `makeView` return authored functions; they do not call those functions. `makeComposition` returns a configured Composition, `prepareBlock` returns an opaque draft, and `Block.assemble` returns the passive completed Block. `Program.make` and `Program.makeElement` return configured Programs. Only `Runtime.run`, `Runtime.hydrate`, or `Runtime.embed` starts execution.

Subscriptions declare `messages`, their Model projection, and `handler` in the entry config. The handler generator returns a function from dependencies to a Stream. When every owned entry has an attached handler, include `subscriptions.layer` in the feature's `EffectsLayer`. The aggregate is a passive recipe, is `Layer.empty` for an empty record, and is unavailable for mixed host ownership. The entry key `layer` is reserved. Individual entry recipes remain available for intentionally selective assembly. The Message declaration limits what that Stream can emit; use `messages: []` for silent scoped work. The generator runs once for a runtime start. Restarting the Subscription reuses that factory and its application-lifetime providers. A host-owned entry may omit `handler` and receive its implementation through `toLayer`, which accepts the implementation Effect constructor.

Mounts use the same `config.handler` generator and `.layer` convention. The returned operation receives the live element; perform DOM work there. Include the definition in its owning Composition's `mounts`. A ManagedResource entry likewise stores a handler generator in its config. The generator returns an object with required `acquire` and `release` functions. Supply cleanup explicitly. A no-op release is appropriate when scoped acquisition already registered the real finalizers, as with `Layer.build`. Foldkit finishes explicit release and scoped cleanup before clearing the handle and emitting `onReleased`.

Name the feature-local alias `FeatureViewBuilder`, derived as `Block.ViewBuilderFor<typeof FeatureComposition>`, for ordinary helpers. Keep it private unless another file uses it. The alias carries the same Message, child, and Mount evidence as the canonical view. Reusable helpers independent of an owner keep the framework's general `HtmlBuilder<Message>`.

Keep the four lifetimes distinct. Application services such as RPC clients last for one Runtime start. A Command Effect lasts for one dispatch. Subscription Streams and ManagedResource handles follow Model conditions. Mount acquisition follows one DOM element. A handler generator may capture a stable service or accessor. It must not capture current time, Command args, Subscription dependencies, a DOM element, or an active ManagedResource handle. Captured services remain fixed for the Runtime start. Contextual lookups use the merged invocation context, where invocation services win. Looking up a service retrieves a provided instance; it does not construct the provider.

Handlers and services may own mutable execution bookkeeping, such as worker availability or protocol request IDs. The Model and update own pending work shown to the user, selections, and submission rules. A `Ref` created in the constructor must not become the source of truth for workflow decisions or state read by view.

Command args contain values already present in the Model or Message. Calling `Date.now()`, `crypto.randomUUID()`, or another source of time or randomness while preparing a Command happens before the Command executes, whether the call appears directly in the args object or its result is assigned to a local variable first. Obtain those values in the returned handler and return them in the result Message.

For the with-args shape, see `repos/foldkit/examples/weather/src/command.ts` or `repos/foldkit/examples/kanban/src/command.ts`. For an argless DOM-side-effect Command, the argless form in `kanban/src/command.ts` (`FocusAddCardInput`) is the canonical reference.

For DOM operations (focus, scroll, modals, scroll lock), Foldkit ships a `Dom` module. For time, randomness, UUIDs, and delays, use Effect's APIs directly (`Clock`, `Random`, `Crypto.Crypto`, `Effect.sleep`). Provide the platform Crypto layer when using `Crypto.Crypto`. Don't reach for raw `document.querySelector`, `setTimeout`, `Date.now()`, or `Math.random()`.

### File Organization

A root uses one of two complete layouts. A genuinely compact root keeps Model, Message, init, update, view, ApplicationDefinition, ApplicationComposition, ApplicationBlock, and any small local handler bundle together in application.ts. Once any root responsibility is extracted, split the whole root: definition.ts owns only ApplicationDefinition when authoring methods use that named value; otherwise composition.ts owns the top-level factory-to-Composition chain; model.ts, message.ts, init.ts, update.ts, view.ts, and optional flags.ts own their named responsibilities; composition.ts owns Bindings, OutMessage folds, complete child/Mount registration, ApplicationComposition, and an optional ApplicationViewBuilder; and block.ts assembles ApplicationBlock. Even a graphless split root has composition.ts. Remove the emptied application.ts instead of using it as an implementation bundle or forwarding barrel. Substantial root Binding policies live under composition/<child>.ts, are exposed through the explicit composition/index.ts barrel, and are imported by composition/composition.ts; external consumers never deep-import the policy or assembly implementation path. Composition imports the Definition and children or Mount definitions, never root init, update, or view. A simple root EffectsLayer stays with its Command definitions in command.ts; use layer.ts only when Layer composition is substantial or reused. entry.ts imports ApplicationBlock, owns the Program host config and startup inputs, supplies ApplicationLayer from services.ts, and starts the Runtime. Name the root Route union ApplicationRoute and a test provider ApplicationTestLayer.

Keep compact features together. A split feature uses `definition.ts` only when it needs a named `FooDefinition` for authoring methods; that file then owns early Model, Message, OutMessage, ChildInitContext, and the authoring contract. It never puts a Composition or owner-specific ViewBuilder there. Put substantial cohesive behavior in a folder-named implementation file such as `workHistory/workHistory.ts`, or retain focused init, update, and command files when they improve navigation. The view imports its Composition and Bindings from composition.ts; the small final `block.ts` imports both, completes the Block, and may compose a small local `EffectsLayer`. Extract feature `layer.ts` only when that composition is substantial or reused.

An ordinary feature barrel exports only its completed `FooBlock`. Put reusable Schemas and pure domain utilities in a separate explicit domain barrel. Split features with children or Mounts use composition.ts for Bindings, complete child/Mount registrations, Composition and an optional owner-specific ViewBuilder alias. Mount-only features use that same file; shared Mount definitions belong in mount.ts. Extract substantial policy to composition/<child>.ts with composition/composition.ts as the assembly point and composition/index.ts as a barrel. External consumers import from composition.ts or the explicit composition/index.ts barrel, never from a policy or assembly implementation path. The barrel namespaces every extracted policy module by child name, for example `export * as Home from './home'; export * as Room from './room'`; consumers can import `{ Home, Room }` from './composition`. Factories remain named within those namespaces, so consumers call `Home.bind(...)`; already constructed Binding values use PascalCase names such as `RoomBinding`. Keep flat named exports for the main Composition assembly surface and straightforward local Bindings. Internal implementation modules may use direct relative sibling imports to avoid barrel cycles. Keep straightforward Bindings there; do not create categories or duplicate child binding lists. A split graphless feature exports its named empty Composition from composition.ts, so view and block.ts import that same graph assembly value. If its Definition has no other use, composition.ts chains the top-level factory directly into makeComposition and no definition.ts is created. A compact graphless feature keeps the named Composition beside its cohesive implementation. Author the primary view through the Composition, return that Composition's opaque draft from the private producer, and complete the adjacent annotated Block with `Block.assemble`. Composition must not import the view, update matcher or completed Block; policy-dependent Steps belong beside Bindings or in independent leaf modules. `makeBinding`configures the relationship; including its result under`bindings`registers it. Runtime constructs Layers and executes effects later. Import each extracted Binding policy through its child-name namespace, such as`Home`, so its factory or Binding and parent-owned Commands remain visibly grouped. Keep extracted policy modules under their child-name namespaces even when a module exports only one value. Keep flat named imports for the main Composition assembly surface and straightforward local Bindings. Keep child feature namespaces distinct from parent-owned policy namespaces. Keep the child Block import inside the policy module so assembly can use `Home` for its composition policy.

Use direct Schema type queries in application annotations. Inside the owning feature, write `typeof Model.Type`, `typeof Message.Type`, or `typeof OutMessage.Type`; outside a child, write `typeof ChildBlock.Model.Type`, `typeof ChildBlock.Message.Type`, or `typeof ChildBlock.OutMessage.Type`. Let Definition and Composition callbacks infer owned parameters. Do not add routine colocated aliases. Keep a type alias when it deliberately publishes a contract or names a useful generic, mapped, or conditional type such as `Block.ViewBuilderFor<typeof FeatureComposition>`.

Start a client-rendered app with `Runtime.run` and an SSR or SSG app with `Runtime.hydrate`. A client-rendered app references its entry from `index.html`. An SSR or SSG app names the entry in `ssr.clientEntry` in `vite.config.ts`, imports CSS from it, and exports `renderDocument` from `src/entry.server.ts` to produce the complete document. Its source tree has no `index.html`.

The definitions (Model, Messages, init, update, view, Commands) never call `Runtime.run` or `Runtime.hydrate`, so tests and server entries can import them without booting a browser runtime. Both calls belong in `entry.ts` or `entry.server.ts`.

For a small app the definitions all fit in one `src/application.ts`. Split when a responsibility has a distinct reason to change and a name you would give it unprompted. Once that happens at the root, move every standard root responsibility to its named file instead of leaving a partial `application.ts`. Extract Messages to `message.ts` when Commands need the constructors; `definition.ts`, `command.ts`, and `update.ts` then import the Message contract directly. Keep Commands in the feature whose update returns them, alongside update or in a feature-local `command.ts` when several definitions or substantial handlers benefit from a separate file.

Use a short section header only when a long file has a substantial group that benefits from one. Routine architecture headings add noise in small application and example files.

### Testing

Test update functions with `foldkit/test`. Since update is pure, tests run without a runtime, DOM, or side effects. Use `story` for update-level tests (send Messages, assert on Model and Commands) and `scene` for feature-level testing through the view with accessible locators.

For an execution test, use the production handler Layer and provide controlled external services beneath it before construction. The test then executes the real request, response mapping, or lifecycle logic with a deterministic API, storage, RPC, clock, or browser provider. Replacing a complete handler exercises the chosen result path and does not test that handler's implementation. Story and Scene tests resolve Commands without executing their handlers.

Import the steps as named imports from `foldkit/story` or `foldkit/scene`: `import { Command, given, message, model, story } from 'foldkit/story'`. A test file needs only one of the two modules. If a single file ever tests both, import the namespaces instead (`import { Scene, Story } from 'foldkit'`) so `Story.given` and `Scene.given` stay distinguishable.

Name each test file for its test style, beside the code under test: `story.test.ts` for the Story tests (which drive `update`) and `scene.test.ts` for the Scene tests (which drive the rendered view). The name describes how the test works, not a source file, so it stays correct whether `update` and `view` live in `application.ts` or in their own files. A test file lives in the folder that holds the code it drives, so in a multi-page app most of them sit in a page folder rather than at the root. When one folder holds more than one test of a kind (sibling pages, component variants), prefix with the subject: `login.story.test.ts`.

Scene runs at any level, since a page's own `update`/`view` pair drops into `scene` unmodified. Put a `scene.test.ts` in the page folder for behavior that page owns, which covers view states awkward to reach through the root Model, and keep a root-level `scene.test.ts` for flows that cross pages, which covers how the parent folds an OutMessage, a Command the parent lifts, a route change, and view inputs the parent computes. If the `repos/foldkit` subtree is available, study the `story.test.ts` and `scene.test.ts` files in `repos/foldkit/examples/`. `repos/foldkit/examples/auth` is the multi-page shape: a root `src/scene.test.ts` for the cross-page login flow alongside `src/page/loggedOut/page/login.scene.test.ts` and `login.story.test.ts` driving that page's own pair.

When a Scene emits a Subscription Message, include the owning Composition and registered `subscriptions` in its config and call `Subscription.emit(entry, message)` with the exact registered entry. Each entry's `messages` collection declares the raw Messages accepted by that step. Scene derives generated child delivery from the registered source and occurrence. Use distinct entry objects for different placements. Silent `messages: []` entries accept no emissions.

## Code Style

- Encode state in discriminated unions, not booleans or nullable fields. `Idle | Loading | Error | Ok`, not `isLoading: boolean`. Make impossible states unrepresentable.
- Use `Option` for absence in the Model and domain values instead of `null` or `undefined`. Foldkit return records are the exception: omit `commands` and `outMessage` when absent. A partial `outMessage.forward` mapper returns `undefined` for each child variant that stops at this Block. Prefix Option-typed values with `maybe*`. Match with `Option.match`; don't unwrap with `Option.map(...)` + `Option.getOrElse(...)` when you can just match.
- Use Effect modules over native methods in `pipe` chains (`Array.map`, `String.startsWith`, `Array.findFirst`). Native methods are fine when calling directly on a named variable.
- Never cast Schema values with `as Type`. Use the callable constructor: `Message.SucceededLogin({ sessionId })`, not `{ _tag: 'SucceededLogin', sessionId } as Message`.
- Always `Array.isArrayEmpty` / `Array.isArrayNonEmpty` (not `.length === 0` / `.length > 0`). Use `Array.match` when handling both empty and non-empty cases.
- Never use `for` loops or `let` for iteration. Reach for `Array.map`, `Array.filterMap`, `Array.makeBy`, `Array.reduce`.
- Never use `T[]`. Always `Array<T>` or `ReadonlyArray<T>`.
- Use `Message.match` for exhaustive Message matching. Use Effect `Match` for other tagged unions, partial matching, fallbacks, and one handler shared across multiple tags. Never use `switch`.
- Always use braces for control flow: `if (foo) { return true }`.
- Don't add inline comments to explain code. Use better names instead. Reserve `// NOTE:` for behavior that would mislead a careful reader.

## Message Layout

Declare the whole Message union with `defineMessageUnion()`:

```ts
const Message = defineMessageUnion({
  ClickedSubmit: {},
  UpdatedEmail: { value: Schema.String },
})
```

When an explicit local annotation needs the decoded union, write `typeof Message.Type` directly. Definition, Composition, and completed Block helpers infer it from the Schema value, so do not add a routine colocated alias. Construct values through the namespace (`Message.ClickedSubmit()`) and handle the union with `Message.match`. Never destructure constructors from `Message` or `OutMessage`; the owning namespace stays visible at every call site.

Keep each case's payload object on one line when it fits. Let Oxfmt wrap payloads that need more space, so the declaration remains easy to scan as one variant per line.

Messages are verb-first past-tense. Common prefixes: `Clicked*`, `Updated*` (input changes and external state updates), `Submitted*`, `Pressed*`, `Selected*`, `Succeeded*` / `Failed*` (paired async results), and `Completed*` (every other Command result). Keep the authored Message local; child delivery variants are generated by the Composition.

## Debugging

This project ships with `@foldkit/devtools-mcp` pre-wired. When the dev server is running and the app is open in a browser, `foldkit_*` MCP tools let you inspect Model, Message history, and time-travel. The generated entry opts into external Message Schema discovery and dispatch with `devTools: { dispatch: true }`; Foldkit derives the Schema from the completed root Block, including generated child envelopes. Reach for those tools before adding `console.log` whenever the question is about state or Message flow.

Treat those tools as privileged access to the application. They can return Models, Message payloads, and Command and Mount arguments to the agent. Keep credentials and private data out of browser state. Use Effect `Redacted` for sensitive values the browser must temporarily hold, and set `devToolsMcpPort: false` in the Foldkit Vite plugin options when an agent should not inspect the running application.

## Going Deeper

For Blocks and OutMessage, Subscriptions, Mount / ManagedResource / CustomElement, field validation, routing, accessibility, and the full convention set, read the live Foldkit code in `repos/foldkit/`. The `examples/` directory and the production apps (`packages/typing-game/`, `packages/website/`) are the highest-fidelity references for any specific pattern. The `foldkit-skills` plugin's `generate-program` and `audit-program` skills carry written snapshot guides if you want a structured walkthrough.
