import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'zustand/middleware';

/** Stockage persistant partagé par les stores (AsyncStorage natif / localStorage web). */
export const persistStorage = createJSONStorage(() => AsyncStorage);
