import {onBeforeUnmount, onMounted} from "vue";
import {TaskBiz} from "../service/TaskService";
import {TaskChangeType, useTaskStore} from "../store/modules/task";
const taskStore = useTaskStore();

export const useTaskChangeRefresh = (biz: TaskBiz, callback: (bizId: string, type: TaskChangeType) => void) => {
    // 🔧 关键修复：使用实例级别的变量存储回调函数引用
    // 这样每个组件实例都有自己独立的回调引用，避免被其他实例覆盖
    let wrappedCallback: ((bizId: string, type: TaskChangeType) => void) | null = null;

    onMounted(async () => {
        // 存储原始回调的引用，确保注册和注销使用完全相同的函数对象
        wrappedCallback = callback;
        taskStore.onChange(biz, wrappedCallback);
        console.log(`[useTaskChangeRefresh] ✓ 已注册 ${biz} 的监听器`);
    });

    onBeforeUnmount(() => {
        // 关键：使用保存的引用进行注销，确保与注册时使用的完全相同
        if (wrappedCallback) {
            taskStore.offChange(biz, wrappedCallback);
            console.log(`[useTaskChangeRefresh] ✓ 已注销 ${biz} 的监听器`);
            wrappedCallback = null;
        }
    });
};
