declare type ServerCallFunctionData = {
    id: string;
    result: {
        [key: string]: any;
    };
    [key: string]: any;
};
declare type ServerCallFunctionOption = {
    taskIdResultKey?: string;
    [key: string]: any;
};
declare type ServerCallFunctionResultData = {
    type: "success" | "retry";
    start: number;
    end: number;
    data: {
        [key: string]: any;
    };
    [key: string]: any;
};
declare type ServerCallFunctionResult = {
    code: number;
    msg: string;
    data: ServerCallFunctionResultData;
};
