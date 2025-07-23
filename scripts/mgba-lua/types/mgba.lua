---@class C
---@field CHECKSUM table<string, number>
---@field GBA_KEY table<string, number>
---@field GB_KEY table<string, number>
---@field PLATFORM table<string, number>
---@field SAVESTATE table<string, number>
---@field SOCKERR table<string, number>
C = C

---@class CallbackManager
---@field add fun(self: CallbackManager, callback: string, fn: function): number
---@field remove fun(self: CallbackManager, cbid: number): nil
callbacks = callbacks

---@class Console
---@field log fun(self: Console, msg: string): nil
---@field error fun(self: Console, msg: string): nil
---@field warn fun(self: Console, msg: string): nil
---@field createBuffer fun(self: Console, name: string): TextBuffer
console = console

---@class Util
---@field expandBitmask fun(self: Util, mask: number): table
---@field makeBitmask fun(self: Util, bits: table): number
util = util

---@class Core
---@field frameadvance fun(self: Core): nil
---@field runFrame fun(self: Core): nil
---@field reset fun(self: Core): nil
---@field read8 fun(self: Core, address: number): number
---@field read16 fun(self: Core, address: number): number
---@field read32 fun(self: Core, address: number): number
---@field write8 fun(self: Core, address: number, value: number): nil
---@field write16 fun(self: Core, address: number, value: number): nil
---@field write32 fun(self: Core, address: number, value: number): nil
---@field currentFrame fun(self: Core): number
---@field getGameCode fun(self: Core): string
---@field getGameTitle fun(self: Core): string
---@field saveStateFile fun(self: Core, path: string, flags: number): boolean
---@field loadStateFile fun(self: Core, path: string, flags: number): boolean
---@field step fun(self: Core): nil
---@field platform fun(self: Core): number
---@field romSize fun(self: Core): number
---@field readRange fun(self: Core, address: number, length: number): string
---@field readRegister fun(self: Core, regName: string): string
---@field writeRegister fun(self: Core, regName: string, value: number): nil
---@field checksum fun(self: Core, type?: number): string
---@field frequency fun(self: Core): number
---@field frameCycles fun(self: Core): number

---@class CoreAdapter : Core
---@field memory table<string, MemoryDomain>

-- Global emu instance (available when a game is loaded)
-- emu is of type CoreAdapter and provided by mGBA
emu = emu

---@class SocketInstance
---@field bind fun(self: SocketInstance, address: string|nil, port: number): number, string|nil
---@field listen fun(self: SocketInstance, backlog?: number): number, string|nil
---@field accept fun(self: SocketInstance): SocketInstance|nil, string|nil
---@field receive fun(self: SocketInstance, maxBytes: number): string|nil, string|nil
---@field send fun(self: SocketInstance, data: string, i?: number, j?: number): number, string|nil
---@field close fun(self: SocketInstance): nil
---@field hasdata fun(self: SocketInstance): boolean
---@field poll fun(self: SocketInstance): nil
---@field add fun(self: SocketInstance, event: string, callback: function): number
---@field remove fun(self: SocketInstance, cbid: number): nil
---@field connect fun(self: SocketInstance, address: string, port: number): number, string|nil

---@class Socket
---@field tcp fun(): SocketInstance
---@field connect fun(address: string, port: number): SocketInstance
---@field bind fun(address: string|nil, port: number): SocketInstance
---@field ERRORS table<string|number, string>
socket = socket

---@class MemoryDomain
---@field base fun(self: MemoryDomain): number
---@field bound fun(self: MemoryDomain): number
---@field name fun(self: MemoryDomain): string
---@field read8 fun(self: MemoryDomain, address: number): number
---@field read16 fun(self: MemoryDomain, address: number): number
---@field read32 fun(self: MemoryDomain, address: number): number
---@field readRange fun(self: MemoryDomain, address: number, length: number): string
---@field write8 fun(self: MemoryDomain, address: number, value: number): nil
---@field write16 fun(self: MemoryDomain, address: number, value: number): nil
---@field write32 fun(self: MemoryDomain, address: number, value: number): nil
---@field size fun(self: MemoryDomain): number

---@class TextBuffer
---@field print fun(self: TextBuffer, text: string): nil
---@field clear fun(self: TextBuffer): nil
---@field setName fun(self: TextBuffer, name: string): nil
---@field setSize fun(self: TextBuffer, cols: number, rows: number): nil
---@field moveCursor fun(self: TextBuffer, x: number, y: number): nil
---@field advance fun(self: TextBuffer, adv: number): nil
---@field getX fun(self: TextBuffer): number
---@field getY fun(self: TextBuffer): number
---@field cols fun(self: TextBuffer): number
---@field rows fun(self: TextBuffer): number
