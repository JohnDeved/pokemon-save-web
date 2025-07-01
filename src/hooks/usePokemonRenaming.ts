import { useState, useCallback } from 'react';

export const usePokemonRenaming = (initialNickname: string, onConfirm: (newName: string) => void) => {
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameInput, setRenameInput] = useState(initialNickname);

    const handleStartEditing = useCallback(() => {
        setIsRenaming(true);
        setRenameInput(initialNickname);
    }, [initialNickname]);

    const handleConfirmRename = useCallback(() => {
        if (!renameInput.trim()) {
            setIsRenaming(false);
            return;
        }
        
        onConfirm(renameInput.trim());
        setIsRenaming(false);
    }, [renameInput, onConfirm]);
    
    const handleCancelRename = useCallback(() => {
        setIsRenaming(false);
        setRenameInput(initialNickname);
    }, [initialNickname]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleConfirmRename();
        if (e.key === 'Escape') handleCancelRename();
    }, [handleConfirmRename, handleCancelRename]);

    return {
        isRenaming,
        renameInput,
        setRenameInput,
        handleStartEditing,
        handleConfirmRename,
        handleCancelRename,
        handleKeyDown
    };
};
