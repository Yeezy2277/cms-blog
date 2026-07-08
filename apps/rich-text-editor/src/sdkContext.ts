import { createContext, useContext } from "react";
import type { FieldAppSDK } from "@contentful/app-sdk";

/** Lets deep editor nodes (embed blocks) reach the SDK for entry/asset lookups. */
export const SdkContext = createContext<FieldAppSDK | null>(null);
export const useFieldSdk = () => useContext(SdkContext);
