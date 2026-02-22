// hooks/useSessionState.ts
import { useState, useEffect, Dispatch, SetStateAction } from 'react';

// hooks/useSessionState.ts - enhanced version
export function useSessionState<T>(
    key: string,
    initialValue: T
): [T, Dispatch<SetStateAction<T>>] {
    const [state, setState] = useState<T>(() => {
        if (typeof window === 'undefined') return initialValue;

        try {
            const item = sessionStorage.getItem(key);
            if (!item) return initialValue;

            const parsed = JSON.parse(item);

            // If initial value is a Set, convert array back to Set
            if (initialValue instanceof Set) {
                return new Set(parsed) as T;
            }

            return parsed as T;
        } catch (error) {
            console.error(`Error reading sessionStorage key "${key}":`, error);
            return initialValue;
        }
    });

    useEffect(() => {
        try {
            // If state is a Set, convert to array for serialization
            const toStore = state instanceof Set ? Array.from(state) : state;
            console.log('***851', JSON.stringify(toStore));
            sessionStorage.setItem(key, JSON.stringify(toStore));
        } catch (error) {
            console.error(`Error writing sessionStorage key "${key}":`, error);
        }
    }, [key, state]);

    return [state, setState];
}