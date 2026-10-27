import {computed, Ref} from "vue";

type CheckAllRecord = {
    _check: boolean;
    [key: string]: any;
};

export const useCheckAll = (props: {records: Ref<CheckAllRecord[] | any[]>}) => {
    const isAllChecked = computed(() => {
        return props.records.value.every(record => record._check);
    });
    const isIndeterminate = computed(() => {
        return props.records.value.some(record => record._check) && !isAllChecked.value;
    });
    const mergeCheck = (records: any[]): any[] => {
        return records.map(record => {
            record._check = false;
            return record;
        });
    };
    const onCheckAll = (value: any) => {
        props.records.value.forEach(record => (record._check = !!value));
    };
    const checkRecords = computed(() => {
        return props.records.value.filter(record => record._check);
    });
    return {
        isAllChecked,
        isIndeterminate,
        mergeCheck,
        onCheckAll,
        checkRecords,
    };
};
