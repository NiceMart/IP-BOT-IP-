import { VideoSubtitleCoverGenerator } from "./aigcserver/VideoSubtitleCoverGenerator";
import { EasyServer } from "./aigcserver/EasyServer";
import { ServerLive } from "./aigcserver/server-live";

export const AigcServer = {
    VideoSubtitleCoverGenerator,
    EasyServer,
    "server-live": ServerLive,
};

export default AigcServer;