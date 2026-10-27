export type TaskRunResult = {
    code: number,
    msg: string,
    data?: {
        status: 'success' | 'pause',
        [key: string]: any,
    }
}
