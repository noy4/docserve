// Public contracts for the docserve widget and its plugins.

/** One HTML page as returned by `GET /api/files`. */
interface DocPage {
  /** Title from `<title>`, else the file name. */
  title: string
  /** Root-absolute URL, e.g. `/guides/intro.html`. */
  url: string
  /** Absolute path on disk. */
  filePath: string
  /** Unix seconds. */
  created: number
  /** Unix seconds. */
  modified?: number
  /** Data URL or absolute URL. */
  favicon?: string
}

/** Identity of the served folder, from the injected script's data attributes. */
interface DocsInfo {
  /** Folder name, e.g. `reports`. */
  name: string
  /** Display path with the home directory collapsed to `~`. */
  path: string
  /** Deterministic hue (0-359) shared with the gallery favicon. */
  hue: number
}

/** Websocket message from `/__reload` describing file changes. */
interface ChangeMessage {
  type: 'change'
  /** Changed page paths relative to the docs root. */
  pages: string[]
  /** True when a page was added or removed. */
  contentSetChanged: boolean
  /** True when the gallery template changed. */
  templateChanged: boolean
}

/** Websocket message from `/__reload` describing stylesheet changes. */
interface CssMessage {
  type: 'css'
  /** Changed stylesheet paths relative to the docs root. */
  files: string[]
}

type LiveMessage = ChangeMessage | CssMessage

/** Event map: event name in keys, listener signature in values. */
interface EventsMap {
  [event: string]: any
}

interface EventUnsubscribe {
  (): void
}

/** Typed event emitter, ported from devframe's `utils/events.ts`. */
interface EventEmitter<Events extends EventsMap> {
  emit: <K extends keyof Events>(event: K, ...args: Parameters<Events[K]>) => void
  emitOnce: <K extends keyof Events>(event: K, ...args: Parameters<Events[K]>) => void
  /** @internal */
  _listeners: Partial<{ [E in keyof Events]: Events[E][] }>
  on: <K extends keyof Events>(event: K, cb: Events[K]) => EventUnsubscribe
  once: <K extends keyof Events>(event: K, cb: Events[K]) => EventUnsubscribe
}

/** Events a plugin can observe. Values are listener signatures. */
interface DocserveEvents {
  'pages:changed': (message: ChangeMessage) => void
  'live:connected': () => void
  'host:started': () => void
}

/** A button (or link) in a dock. */
interface DockItem {
  /** Unique within the dock; also `data-action`. */
  id: string
  /** Used for the button `title` and `aria-label`. */
  title: string
  /** Inline SVG markup. */
  icon?: string
  /** Ascending; default 0. */
  order?: number
  /** Items in different categories get a divider between them. */
  category?: string
  /** Command id run through `ctx.commands`; exactly one of `command` / `href`. */
  command?: string
  /** Rendered as `<a href>` instead of a command button. */
  href?: string
  /** Mirrors `aria-pressed`. */
  isActive?: () => boolean
}

interface DocksItemHandle {
  /** Null until the dock is rendered. */
  element: HTMLElement | null
  /** Re-evaluate `isActive`. */
  update: () => void
  dispose: () => void
}

/** One command, reachable from a shortcut and from the palette. */
interface DocserveCommand {
  /** Unique; core ids start with `docserve:`, plugins use `plugin:<id>:<name>`. */
  id: string
  /** Palette row text and dock `title`. */
  title: string
  /** Optional palette subtitle. */
  description?: string
  /** Optional palette section heading. */
  category?: string
  /** Inline SVG markup, shared with dock items. */
  icon?: string
  /** Normalized shortcuts: `"Mod+K"`, `"Alt+B"`, `"Shift+C"`, `"["`. */
  keys?: string[]
  /** Default true; `false` keeps it out of the palette. */
  showInPalette?: boolean
  /** False when the command cannot run right now. */
  when?: () => boolean
  /** Runs on shortcut or palette selection. */
  run: (ctx: DocserveContext) => void | Promise<void>
}

/** Command registry plus the palette it feeds. */
interface CommandsContext {
  /** Throws on a duplicate id; the result unregisters. */
  register: (command: DocserveCommand) => () => void
  /** Rejects when the id is unknown or `when()` is false. */
  run: (id: string) => Promise<void>
  /** Available commands, in registration order. */
  list: () => DocserveCommand[]
  palette: {
    open: () => void
    close: () => void
    toggle: () => void
    isOpen: () => boolean
  }
}

/** The single dock. Plugins register and remove items; only core owns the container. */
interface DocksContext {
  element: HTMLElement
  /** Throws on a duplicate id; the returned handle can update or dispose the item. */
  register: (item: DockItem) => DocksItemHandle
  /** Removes a single item by id. */
  remove: (id: string) => void
  /** Items currently mounted, in render order. */
  items: () => DockItem[]
}

/**
 * In-page method bus. Plugins never import each other; they talk through this.
 * `docserve:` is reserved for core methods, plugins use `plugin:<id>:<method>`.
 */
interface RpcContext {
  /** Throws on a duplicate name. */
  register: (name: string, handler: (...args: any[]) => any) => () => void
  has: (name: string) => boolean
  /** Rejects on an unknown name. */
  call: (name: string, ...args: any[]) => Promise<any>
}

interface UiContext {
  /** Appends a layout-neutral host (`display: contents`) to the shadow root. */
  mountPoint: () => HTMLElement
  /** Adds a `<link>` inside the shadow root once. */
  style: (href: string) => void
  /** Writes to the live region. */
  announce: (message: string) => void
}

/** The only object a plugin receives. */
interface DocserveContext {
  /** Current page path from `data-page`. */
  page: string
  /** Served folder identity from `data-docs-*`; undefined when unset. */
  docs?: DocsInfo
  rpc: RpcContext
  /** The one dock every plugin contributes items to. */
  docks: DocksContext
  /** Shortcut and palette registry. */
  commands: CommandsContext
  ui: UiContext
  /** Event bus; subscribe with `events.on`. */
  events: EventEmitter<DocserveEvents>
}

/** A plugin. `setup` runs once; its return value runs on teardown. */
interface DocservePlugin {
  id: string
  setup?: (ctx: DocserveContext) => void | (() => void)
}