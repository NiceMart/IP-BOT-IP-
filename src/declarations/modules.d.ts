declare module "../pages/Live/util";

declare module "@codemirror/view" {
    export class EditorView {
        state: any;
        constructor(config?: any);
        dispatch(transaction: any): void;
    }

    export const keymap: { of: (...args: any[]) => any };
    export const lineNumbers: (...args: any[]) => any;
}

declare module "@uiw/codemirror-theme-dracula" {
    export const dracula: any;
}

declare module "@uiw/codemirror-theme-quietlight" {
    export const quietlight: any;
}

declare module "@codemirror/lang-python" {
    export const python: (...args: any[]) => any;
}

declare module "@codemirror/commands" {
    export const defaultKeymap: any;
}

declare module "@codemirror/state" {
    export class EditorState {
        static readOnly: { of: (value: boolean) => any };
    }
}

declare module "@vueuse/core" {
    export const useDebounceFn: <T extends (...args: any[]) => any>(fn: T, ms?: number) => T;
    export const useThrottleFn: <T extends (...args: any[]) => any>(fn: T, ms?: number) => T;
}

declare module "*module/Workflow/core/type" {
    export type NodeRunResultStatus = string;
    export type NodeRunController = any;
    export type NodeRunParam = any;
    export type NodeRunResult = {
        status: NodeRunResultStatus;
        statusMsg?: string;
        runOutputs?: Record<string, any>;
        runData?: Record<string, any>;
        pauseByType?: string;
        pauseById?: string;
    };
    export type NodeFunctionCall = any;
}

declare module "*module/Workflow/nodes/FunctionCall/lib" {
    export type FunctionCallNodeProps = any;
    export type FunctionCallNodeEmits = any;
    export const useFunctionCallNode: (...args: any[]) => any;
}
