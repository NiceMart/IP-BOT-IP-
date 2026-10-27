import {computed, ref} from "vue";

export const usePaginate = <T = any>(data?: {pageSize?: number; filter?: (item: T) => boolean}) => {
    data = data || {};
    const records = ref<T[]>([]);
    const pageSize = data.pageSize && data.pageSize > 0 ? data.pageSize : 10;
    const page = ref(1);
    const recordsFilterCount = ref(0);
    const recordsForPage = computed(() => {
        let items = records.value;
        if (data.filter) {
            items = items.filter(data.filter as (item: (typeof items)[number]) => boolean);
        }
        recordsFilterCount.value = items.length;
        if (items.length === 0) {
            return [];
        }
        return items.slice((page.value - 1) * pageSize, page.value * pageSize);
    });
    return {
        page,
        pageSize,
        records,
        recordsFilterCount,
        recordsForPage,
    };
};
