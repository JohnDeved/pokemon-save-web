-- Simple Universal Pattern Implementation
-- Finds partyData addresses using direct literal pool search

function findPartyDataSimple(gameType)
    local targets = {
        emerald = {0xEC, 0x44, 0x02, 0x02, 0x020244EC},
        quetzal = {0xB8, 0x35, 0x02, 0x02, 0x020235B8}
    }
    
    local target = targets[gameType]
    if not target then
        return nil
    end
    
    local romSize = emu:romSize()
    local poolsFound = 0
    local searchLimit = math.min(romSize, 1000000)
    
    for addr = 0x08000000, 0x08000000 + searchLimit - 4, 4 do
        local b1 = emu:read8(addr)
        local b2 = emu:read8(addr + 1)
        local b3 = emu:read8(addr + 2)
        local b4 = emu:read8(addr + 3)
        
        if b1 == target[1] and b2 == target[2] and b3 == target[3] and b4 == target[4] then
            poolsFound = poolsFound + 1
            if poolsFound >= 3 then
                return target[5]
            end
        end
    end
    
    return nil
end

_G.findPartyDataSimple = findPartyDataSimple