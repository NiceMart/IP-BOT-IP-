export interface VideoSubtitleCoverGeneratorModelConfig {
    video: string;
    referenceText: string;
    subtitleStyle: {
        fontFamily: string;
        fontSize: number;
        fontColor: string;
        backgroundColor: string;
        backgroundColorOpacity: number;
        position: string;
    };
    coverStyle: {
        timePointType: string;
        customTimePoint: number;
        textOverlay: string;
        fontSize: number;
        fontColor: string;
        position: string;
        backgroundColor: boolean;
        backgroundOpacity: number;
        maxWidth: number;
        effectType: string;
        quality: number;
    };
    subtitleTemplate: string;
    coverTemplate: string;
    serverKey?: string;
}

export interface SubtitlePreset {
    id: string;
    name: string;
    style: VideoSubtitleCoverGeneratorModelConfig['subtitleStyle'];
}

export interface CoverPreset {
    id: string;
    name: string;
    description: string;
    style: VideoSubtitleCoverGeneratorModelConfig['coverStyle'];
}