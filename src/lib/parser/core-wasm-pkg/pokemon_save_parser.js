let wasm;

const cachedTextDecoder = (typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8', { ignoreBOM: true, fatal: true }) : { decode: () => { throw Error('TextDecoder not available') } } );

if (typeof TextDecoder !== 'undefined') { cachedTextDecoder.decode(); };

let cachedUint8ArrayMemory0 = null;

function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

let WASM_VECTOR_LEN = 0;

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_export_0.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}
/**
 * @returns {string}
 */
export function test_wasm() {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.test_wasm();
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

let cachedDataViewMemory0 = null;

function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

function getArrayJsValueFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    const mem = getDataViewMemory0();
    const result = [];
    for (let i = ptr; i < ptr + 4 * len; i += 4) {
        result.push(wasm.__wbindgen_export_0.get(mem.getUint32(i, true)));
    }
    wasm.__externref_drop_slice(ptr, len);
    return result;
}
/**
 * Convert GBA-encoded bytes to a readable string
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function bytes_to_gba_string(bytes) {
    let deferred2_0;
    let deferred2_1;
    try {
        const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.bytes_to_gba_string(ptr0, len0);
        deferred2_0 = ret[0];
        deferred2_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
}

const cachedTextEncoder = (typeof TextEncoder !== 'undefined' ? new TextEncoder('utf-8') : { encode: () => { throw Error('TextEncoder not available') } } );

const encodeString = (typeof cachedTextEncoder.encodeInto === 'function'
    ? function (arg, view) {
    return cachedTextEncoder.encodeInto(arg, view);
}
    : function (arg, view) {
    const buf = cachedTextEncoder.encode(arg);
    view.set(buf);
    return {
        read: arg.length,
        written: buf.length
    };
});

function passStringToWasm0(arg, malloc, realloc) {

    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }

    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = encodeString(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}
/**
 * Convert a string to GBA-encoded bytes
 * @param {string} text
 * @param {number} length
 * @returns {Uint8Array}
 */
export function gba_string_to_bytes(text, length) {
    const ptr0 = passStringToWasm0(text, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.gba_string_to_bytes(ptr0, len0, length);
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * Get Pokemon nature from personality value
 * @param {number} personality
 * @returns {string}
 */
export function get_pokemon_nature(personality) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.get_pokemon_nature(personality);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Calculate sector checksum for Pokemon save data
 * @param {Uint8Array} sector_data
 * @returns {number}
 */
export function calculate_sector_checksum(sector_data) {
    const ptr0 = passArray8ToWasm0(sector_data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.calculate_sector_checksum(ptr0, len0);
    return ret;
}

/**
 * Read a little-endian u16 from bytes at offset
 * @param {Uint8Array} bytes
 * @param {number} offset
 * @returns {number}
 */
export function read_u16_le(bytes, offset) {
    const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.read_u16_le(ptr0, len0, offset);
    return ret;
}

/**
 * Read a little-endian u32 from bytes at offset
 * @param {Uint8Array} bytes
 * @param {number} offset
 * @returns {number}
 */
export function read_u32_le(bytes, offset) {
    const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.read_u32_le(ptr0, len0, offset);
    return ret >>> 0;
}

/**
 * Check if Pokemon is shiny based on personality and OT ID
 * @param {number} personality
 * @param {number} ot_id
 * @returns {boolean}
 */
export function is_pokemon_shiny(personality, ot_id) {
    const ret = wasm.is_pokemon_shiny(personality, ot_id);
    return ret !== 0;
}

/**
 * Get the shiny value for determining shininess
 * @param {number} personality
 * @param {number} ot_id
 * @returns {number}
 */
export function get_shiny_value(personality, ot_id) {
    const ret = wasm.get_shiny_value(personality, ot_id);
    return ret;
}

/**
 * Format playtime as a human-readable string
 * @param {number} hours
 * @param {number} minutes
 * @param {number} seconds
 * @returns {string}
 */
export function format_play_time(hours, minutes, seconds) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.format_play_time(hours, minutes, seconds);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

function _assertClass(instance, klass) {
    if (!(instance instanceof klass)) {
        throw new Error(`expected instance of ${klass.name}`);
    }
}

const PlayTimeDataFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_playtimedata_free(ptr >>> 0, 1));

export class PlayTimeData {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(PlayTimeData.prototype);
        obj.__wbg_ptr = ptr;
        PlayTimeDataFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        PlayTimeDataFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_playtimedata_free(ptr, 0);
    }
    /**
     * @param {number} hours
     * @param {number} minutes
     * @param {number} seconds
     */
    constructor(hours, minutes, seconds) {
        const ret = wasm.playtimedata_new(hours, minutes, seconds);
        this.__wbg_ptr = ret >>> 0;
        PlayTimeDataFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {number}
     */
    get hours() {
        const ret = wasm.playtimedata_hours(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get minutes() {
        const ret = wasm.playtimedata_minutes(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get seconds() {
        const ret = wasm.playtimedata_seconds(this.__wbg_ptr);
        return ret;
    }
}

const PokemonFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_pokemon_free(ptr >>> 0, 1));

export class Pokemon {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(Pokemon.prototype);
        obj.__wbg_ptr = ptr;
        PokemonFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        PokemonFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_pokemon_free(ptr, 0);
    }
    /**
     * Create a new Pokemon from raw byte data
     * @param {Uint8Array} raw_bytes
     */
    constructor(raw_bytes) {
        const ptr0 = passArray8ToWasm0(raw_bytes, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.pokemon_new(ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        this.__wbg_ptr = ret[0] >>> 0;
        PokemonFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Create a Pokemon from JavaScript Uint8Array
     * @param {Uint8Array} bytes
     * @returns {Pokemon}
     */
    static from_bytes(bytes) {
        const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.pokemon_from_bytes(ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return Pokemon.__wrap(ret[0]);
    }
    /**
     * Get the raw bytes of this Pokemon
     * @returns {Uint8Array}
     */
    get_raw_bytes() {
        const ret = wasm.pokemon_get_raw_bytes(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * Get Pokemon's personality value
     * @returns {number}
     */
    get personality() {
        const ret = wasm.pokemon_personality(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Set Pokemon's personality value
     * @param {number} value
     */
    set personality(value) {
        wasm.pokemon_set_personality(this.__wbg_ptr, value);
    }
    /**
     * Get Pokemon's Original Trainer ID
     * @returns {number}
     */
    get ot_id() {
        const ret = wasm.pokemon_ot_id(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Set Pokemon's Original Trainer ID
     * @param {number} value
     */
    set ot_id(value) {
        wasm.pokemon_set_ot_id(this.__wbg_ptr, value);
    }
    /**
     * Get Pokemon's nickname
     * @returns {string}
     */
    get nickname() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.pokemon_nickname(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * Get Pokemon's Original Trainer name
     * @returns {string}
     */
    get ot_name() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.pokemon_ot_name(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * Get Pokemon's current HP
     * @returns {number}
     */
    get current_hp() {
        const ret = wasm.pokemon_current_hp(this.__wbg_ptr);
        return ret;
    }
    /**
     * Set Pokemon's current HP
     * @param {number} value
     */
    set current_hp(value) {
        wasm.pokemon_set_current_hp(this.__wbg_ptr, value);
    }
    /**
     * Get Pokemon's maximum HP
     * @returns {number}
     */
    get max_hp() {
        const ret = wasm.pokemon_max_hp(this.__wbg_ptr);
        return ret;
    }
    /**
     * Set Pokemon's maximum HP
     * @param {number} value
     */
    set max_hp(value) {
        wasm.pokemon_set_max_hp(this.__wbg_ptr, value);
    }
    /**
     * Get Pokemon's attack stat
     * @returns {number}
     */
    get attack() {
        const ret = wasm.pokemon_attack(this.__wbg_ptr);
        return ret;
    }
    /**
     * Set Pokemon's attack stat
     * @param {number} value
     */
    set attack(value) {
        wasm.pokemon_set_attack(this.__wbg_ptr, value);
    }
    /**
     * Get Pokemon's defense stat
     * @returns {number}
     */
    get defense() {
        const ret = wasm.pokemon_defense(this.__wbg_ptr);
        return ret;
    }
    /**
     * Set Pokemon's defense stat
     * @param {number} value
     */
    set defense(value) {
        wasm.pokemon_set_defense(this.__wbg_ptr, value);
    }
    /**
     * Get Pokemon's speed stat
     * @returns {number}
     */
    get speed() {
        const ret = wasm.pokemon_speed(this.__wbg_ptr);
        return ret;
    }
    /**
     * Set Pokemon's speed stat
     * @param {number} value
     */
    set speed(value) {
        wasm.pokemon_set_speed(this.__wbg_ptr, value);
    }
    /**
     * Get Pokemon's special attack stat
     * @returns {number}
     */
    get sp_attack() {
        const ret = wasm.pokemon_sp_attack(this.__wbg_ptr);
        return ret;
    }
    /**
     * Set Pokemon's special attack stat
     * @param {number} value
     */
    set sp_attack(value) {
        wasm.pokemon_set_sp_attack(this.__wbg_ptr, value);
    }
    /**
     * Get Pokemon's special defense stat
     * @returns {number}
     */
    get sp_defense() {
        const ret = wasm.pokemon_sp_defense(this.__wbg_ptr);
        return ret;
    }
    /**
     * Set Pokemon's special defense stat
     * @param {number} value
     */
    set sp_defense(value) {
        wasm.pokemon_set_sp_defense(this.__wbg_ptr, value);
    }
    /**
     * Get Pokemon's level
     * @returns {number}
     */
    get level() {
        const ret = wasm.pokemon_level(this.__wbg_ptr);
        return ret;
    }
    /**
     * Set Pokemon's level
     * @param {number} value
     */
    set level(value) {
        wasm.pokemon_set_level(this.__wbg_ptr, value);
    }
    /**
     * Get Pokemon's status condition
     * @returns {number}
     */
    get status() {
        const ret = wasm.pokemon_status(this.__wbg_ptr);
        return ret;
    }
    /**
     * Set Pokemon's status condition
     * @param {number} value
     */
    set status(value) {
        wasm.pokemon_set_status(this.__wbg_ptr, value);
    }
    /**
     * Get Pokemon's nature based on personality
     * @returns {string}
     */
    get nature() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.pokemon_nature(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * Check if Pokemon is shiny
     * @returns {boolean}
     */
    get is_shiny() {
        const ret = wasm.pokemon_is_shiny(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * Get the shiny value (lower values = more likely to be shiny)
     * @returns {number}
     */
    get shiny_value() {
        const ret = wasm.pokemon_shiny_value(this.__wbg_ptr);
        return ret;
    }
    /**
     * Get all stats as a PokemonStats object
     * @returns {PokemonStats}
     */
    get_stats() {
        const ret = wasm.pokemon_get_stats(this.__wbg_ptr);
        return PokemonStats.__wrap(ret);
    }
    /**
     * Check if Pokemon data appears valid (has non-zero species ID)
     * @returns {boolean}
     */
    is_valid() {
        const ret = wasm.pokemon_is_valid(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * Get a formatted string representation of the Pokemon
     * @returns {string}
     */
    to_string() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.pokemon_to_string(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
}

const PokemonStatsFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_pokemonstats_free(ptr >>> 0, 1));

export class PokemonStats {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(PokemonStats.prototype);
        obj.__wbg_ptr = ptr;
        PokemonStatsFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        PokemonStatsFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_pokemonstats_free(ptr, 0);
    }
    /**
     * @param {number} hp
     * @param {number} attack
     * @param {number} defense
     * @param {number} speed
     * @param {number} sp_attack
     * @param {number} sp_defense
     */
    constructor(hp, attack, defense, speed, sp_attack, sp_defense) {
        const ret = wasm.pokemonstats_new(hp, attack, defense, speed, sp_attack, sp_defense);
        this.__wbg_ptr = ret >>> 0;
        PokemonStatsFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {number}
     */
    get hp() {
        const ret = wasm.pokemonstats_hp(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get attack() {
        const ret = wasm.pokemonstats_attack(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get defense() {
        const ret = wasm.pokemonstats_defense(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get speed() {
        const ret = wasm.pokemonstats_speed(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get sp_attack() {
        const ret = wasm.pokemonstats_sp_attack(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get sp_defense() {
        const ret = wasm.pokemonstats_sp_defense(this.__wbg_ptr);
        return ret;
    }
}

const SaveDataFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_savedata_free(ptr >>> 0, 1));

export class SaveData {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(SaveData.prototype);
        obj.__wbg_ptr = ptr;
        SaveDataFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        SaveDataFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_savedata_free(ptr, 0);
    }
    /**
     * @param {string} player_name
     * @param {number} active_slot
     * @param {PlayTimeData} play_time
     */
    constructor(player_name, active_slot, play_time) {
        const ptr0 = passStringToWasm0(player_name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        _assertClass(play_time, PlayTimeData);
        var ptr1 = play_time.__destroy_into_raw();
        const ret = wasm.savedata_new(ptr0, len0, active_slot, ptr1);
        this.__wbg_ptr = ret >>> 0;
        SaveDataFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {string}
     */
    get player_name() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.savedata_player_name(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {number}
     */
    get active_slot() {
        const ret = wasm.savedata_active_slot(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {PlayTimeData}
     */
    get play_time() {
        const ret = wasm.savedata_play_time(this.__wbg_ptr);
        return PlayTimeData.__wrap(ret);
    }
}

const SaveParserFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_saveparser_free(ptr >>> 0, 1));

export class SaveParser {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        SaveParserFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_saveparser_free(ptr, 0);
    }
    /**
     * Create a new SaveParser instance
     */
    constructor() {
        const ret = wasm.saveparser_new();
        this.__wbg_ptr = ret >>> 0;
        SaveParserFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Load save data from bytes
     * @param {Uint8Array} data
     */
    load_save_data(data) {
        const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.saveparser_load_save_data(this.__wbg_ptr, ptr0, len0);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * Parse the complete save data and return SaveData
     * @returns {SaveData}
     */
    parse() {
        const ret = wasm.saveparser_parse(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return SaveData.__wrap(ret[0]);
    }
    /**
     * Get party Pokemon from the save data
     * @returns {Pokemon[]}
     */
    get_party_pokemon() {
        const ret = wasm.saveparser_get_party_pokemon(this.__wbg_ptr);
        if (ret[3]) {
            throw takeFromExternrefTable0(ret[2]);
        }
        var v1 = getArrayJsValueFromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * Get player name from save data
     * @returns {string}
     */
    get_player_name() {
        let deferred2_0;
        let deferred2_1;
        try {
            const ret = wasm.saveparser_get_player_name(this.__wbg_ptr);
            var ptr1 = ret[0];
            var len1 = ret[1];
            if (ret[3]) {
                ptr1 = 0; len1 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred2_0 = ptr1;
            deferred2_1 = len1;
            return getStringFromWasm0(ptr1, len1);
        } finally {
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    }
    /**
     * Get play time from save data
     * @returns {PlayTimeData}
     */
    get_play_time() {
        const ret = wasm.saveparser_get_play_time(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return PlayTimeData.__wrap(ret[0]);
    }
    /**
     * Get information about all sectors
     * @param {number} sector_index
     * @returns {SectorInfo}
     */
    get_sector_info(sector_index) {
        const ret = wasm.saveparser_get_sector_info(this.__wbg_ptr, sector_index);
        return SectorInfo.__wrap(ret);
    }
    /**
     * Get the active slot number (1 or 2)
     * @returns {number}
     */
    get_active_slot() {
        const ret = wasm.saveparser_get_active_slot(this.__wbg_ptr);
        return ret;
    }
    /**
     * Get total number of valid sectors found
     * @returns {number}
     */
    get_valid_sector_count() {
        const ret = wasm.saveparser_get_valid_sector_count(this.__wbg_ptr);
        return ret >>> 0;
    }
}

const SectorInfoFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_sectorinfo_free(ptr >>> 0, 1));

export class SectorInfo {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(SectorInfo.prototype);
        obj.__wbg_ptr = ptr;
        SectorInfoFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        SectorInfoFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_sectorinfo_free(ptr, 0);
    }
    /**
     * @param {number} id
     * @param {number} checksum
     * @param {number} counter
     * @param {boolean} valid
     */
    constructor(id, checksum, counter, valid) {
        const ret = wasm.sectorinfo_new(id, checksum, counter, valid);
        this.__wbg_ptr = ret >>> 0;
        SectorInfoFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {number}
     */
    get id() {
        const ret = wasm.sectorinfo_id(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get checksum() {
        const ret = wasm.sectorinfo_checksum(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get counter() {
        const ret = wasm.sectorinfo_counter(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {boolean}
     */
    get valid() {
        const ret = wasm.sectorinfo_valid(this.__wbg_ptr);
        return ret !== 0;
    }
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);

            } catch (e) {
                if (module.headers.get('Content-Type') != 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else {
                    throw e;
                }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);

    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };

        } else {
            return instance;
        }
    }
}

function __wbg_get_imports() {
    const imports = {};
    imports.wbg = {};
    imports.wbg.__wbg_log_e4817390530c0883 = function(arg0, arg1) {
        console.log(getStringFromWasm0(arg0, arg1));
    };
    imports.wbg.__wbg_pokemon_new = function(arg0) {
        const ret = Pokemon.__wrap(arg0);
        return ret;
    };
    imports.wbg.__wbindgen_error_new = function(arg0, arg1) {
        const ret = new Error(getStringFromWasm0(arg0, arg1));
        return ret;
    };
    imports.wbg.__wbindgen_init_externref_table = function() {
        const table = wasm.__wbindgen_export_0;
        const offset = table.grow(4);
        table.set(0, undefined);
        table.set(offset + 0, undefined);
        table.set(offset + 1, null);
        table.set(offset + 2, true);
        table.set(offset + 3, false);
        ;
    };
    imports.wbg.__wbindgen_throw = function(arg0, arg1) {
        throw new Error(getStringFromWasm0(arg0, arg1));
    };

    return imports;
}

function __wbg_init_memory(imports, memory) {

}

function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    __wbg_init.__wbindgen_wasm_module = module;
    cachedDataViewMemory0 = null;
    cachedUint8ArrayMemory0 = null;


    wasm.__wbindgen_start();
    return wasm;
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (typeof module !== 'undefined') {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();

    __wbg_init_memory(imports);

    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }

    const instance = new WebAssembly.Instance(module, imports);

    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (typeof module_or_path !== 'undefined') {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (typeof module_or_path === 'undefined') {
        module_or_path = new URL('pokemon_save_parser_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    __wbg_init_memory(imports);

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync };
export default __wbg_init;
