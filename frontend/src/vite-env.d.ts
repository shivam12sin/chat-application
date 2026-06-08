/// <reference types="vite/client" />

declare module '*.mov' {
    const src: string;
    export default src;
}

declare module '*.mp4' {
    const src: string;
    export default src;
}


interface ImportMetaEnv {
    readonly VITE_SOCKET_URL: string;
    readonly VITE_API_URL: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
