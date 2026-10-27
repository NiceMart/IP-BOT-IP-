import {TinyEmitter} from "tiny-emitter";

const emitter = new TinyEmitter();

export const GlobalEvent = {
    on: function (event: string, callback: Function) {
        emitter.on(event, callback);
    },
    once: function (event: string, callback: Function) {
        emitter.once(event, callback);
    },
    off: function (event: string, callback?: Function) {
        if (callback) {
            emitter.off(event, callback);
        } else {
            // 不传callback时，移除该事件的所有监听器
            emitter.off(event);
        }
    },
    emit: function (event: string, ...args: any[]) {
        emitter.emit(event, ...args);
    },
    // 🔧 添加方法：移除特定事件的所有监听器
    removeAllListeners: function (event?: string) {
        if (event) {
            // 直接调用 off(event) 不传callback，移除该事件的所有监听器
            emitter.off(event);
            console.log(`[GlobalEvent] 已移除 "${event}" 的所有监听器`);
        } else {
            // 清空所有事件监听器
            (emitter as any).e = {};
            console.log('[GlobalEvent] 已清空所有事件监听器');
        }
    },
    // 🔧 调试方法：获取当前监听器数量
    getListenerCount: function (event: string): number {
        const e = (emitter as any).e || {};
        return e[event] ? e[event].length : 0;
    },
};
