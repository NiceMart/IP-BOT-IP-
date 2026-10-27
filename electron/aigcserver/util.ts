import {t} from "../config/lang";

export const AigcServerUtil = {
    errorDetect: (data: string): string | null => {
        const errorMap = {
            "torch.cuda.OutOfMemoryError": t("CUDA内存不足"),
        };
        for (const [key, value] of Object.entries(errorMap)) {
            if (data.includes(key)) {
                return value;
            }
        }
        return null;
    },
};
