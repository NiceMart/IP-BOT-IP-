/**
* 阿里云 CosyVoice 系统音色统一定义
*
* 所有组件（SoundPromptSelector、SoundPromptDialog、VideoIPAgent）共享同一份数据，
* 避免三份副本不一致的问题。
*
* ⚠️ 音色ID 严格对齐阿里云官方文档（cosyvoice-v3-flash）：
* - 两个无 _v3 后缀的标杆音色：longanhuan、longanyang
* - 其他中文音色：long*_v3
* - 外语音色：loong*_v3
* - v3-flash 不支持的音色：西班牙语/俄语/意大利语/法语/德语（仅 v2 支持）
*
* 参考：https://help.aliyun.com/zh/model-studio/cosyvoice-voice-list
*/

export interface SystemVoice {
    id: string;
    title: string;
    desc: string;
    aliyunVoiceId: string;
    isSystem: boolean;
    category: string; // 分类标签
    /** 该音色是否在 cosyvoice-v3-flash 中可用（部分外语/特殊音色仅 v2 支持） */
    supportedInV3Flash: boolean;
}

/** 系统音色分类定义（用于 UI 标签页） */
export const SYSTEM_VOICE_CATEGORIES = [
    { key: '全部', label: '全部' },
    { key: '我的音色', label: '我的音色' },
    { key: '女声', label: '女声' },
    { key: '男声', label: '男声' },
    { key: '童声', label: '童声' },
    { key: '方言', label: '方言' },
    { key: '外语', label: '外语' },
    { key: '社交陪伴', label: '社交陪伴' },
    { key: '语音助手', label: '语音助手' },
    { key: '客服', label: '客服' },
    { key: '有声书', label: '有声书' },
    { key: '其他', label: '其他' },
] as const;

/** 简化版类型（用于不需要 desc/isSystem/category 的场景） */
export interface SystemVoiceSimple {
    id: string;
    title: string;
    aliyunVoiceId: string;
}

/**
 * 完整系统音色列表
 *
 * 音色严格对齐 cosyvoice-v3-flash 官方支持列表
 * unsupportedInV3Flash 的音色已移除或标注
 */
export const systemVoices: SystemVoice[] = [
    // ========== 标杆音色（无 _v3 后缀） ==========
    { id: 'sys_Cherry', title: '龙安欢·芊悦（普通话女声）', desc: '洒脱元气女｜适合：普通话', aliyunVoiceId: 'longanhuan', isSystem: true, category: '女声', supportedInV3Flash: true },
    { id: 'sys_Ethan', title: '龙安洋·晨煦（普通话男声）', desc: '阳光大男孩｜适合：普通话', aliyunVoiceId: 'longanyang', isSystem: true, category: '男声', supportedInV3Flash: true },

    // ========== 基础女声 ==========
    { id: 'sys_Chelsie', title: '龙菲菲·千雪（二次元女声）', desc: '甜美娇气女｜适合：普通话', aliyunVoiceId: 'longfeifei_v3', isSystem: true, category: '女声', supportedInV3Flash: true },
    { id: 'sys_Momo', title: '龙呼呼·茉兔（活泼女声）', desc: '天真烂漫女童｜适合：普通话', aliyunVoiceId: 'longhuhu_v3', isSystem: true, category: '女声', supportedInV3Flash: true },
    { id: 'sys_Vivian', title: '龙安灵·十三（个性女声）', desc: '思维灵动女｜适合：普通话', aliyunVoiceId: 'longanling_v3', isSystem: true, category: '女声', supportedInV3Flash: true },
    { id: 'sys_Maia', title: '龙安亲·四月（知性女声）', desc: '亲和活泼女｜适合：普通话', aliyunVoiceId: 'longanqin_v3', isSystem: true, category: '女声', supportedInV3Flash: true },
    { id: 'sys_Katerina', title: '龙应桃·卡捷琳娜（御姐女声）', desc: '温柔淡定女｜适合：普通话', aliyunVoiceId: 'longyingtao_v3', isSystem: true, category: '女声', supportedInV3Flash: true },
    { id: 'sys_Bellona', title: '龙安温·燕铮莺（洪亮女声）', desc: '优雅知性女｜适合：普通话', aliyunVoiceId: 'longanwen_v3', isSystem: true, category: '女声', supportedInV3Flash: true },
    { id: 'sys_Bunny', title: '龙应笑·萌小姬（萌系女声）', desc: '清甜推销女｜适合：普通话', aliyunVoiceId: 'longyingxiao_v3', isSystem: true, category: '女声', supportedInV3Flash: true },
    { id: 'sys_Mia', title: '龙应询·乖小妹（温顺女声）', desc: '年轻青涩男｜适合：普通话', aliyunVoiceId: 'longyingxun_v3', isSystem: true, category: '女声', supportedInV3Flash: true },
    { id: 'sys_Nini', title: '龙老姨·邻家妹妹（甜美女声）', desc: '烟火从容阿姨｜适合：普通话', aliyunVoiceId: 'longlaoyi_v3', isSystem: true, category: '女声', supportedInV3Flash: true },
    { id: 'sys_Ebona', title: '龙机器·诡婆婆（惊悚女声）', desc: '呆萌机器人｜适合：普通话', aliyunVoiceId: 'longjiqi_v3', isSystem: true, category: '女声', supportedInV3Flash: true },
    { id: 'sys_Seren', title: '龙猴哥·小婉（助眠女声）', desc: '经典猴哥｜适合：普通话', aliyunVoiceId: 'longhouge_v3', isSystem: true, category: '女声', supportedInV3Flash: true },
    { id: 'sys_Stella', title: '龙安粤·少女阿月（元气女声）', desc: '欢脱粤语男（也可普通话）｜适合：普通话/粤语', aliyunVoiceId: 'longanyue_v3', isSystem: true, category: '女声', supportedInV3Flash: true },
    { id: 'sys_Serena', title: '龙婉君·苏瑶（温柔女声）', desc: '细腻柔声女｜适合：普通话', aliyunVoiceId: 'longwanjun_v3', isSystem: true, category: '女声', supportedInV3Flash: true },
    { id: 'sys_Jennifer', title: '龙安雅·詹妮弗（美语女声）', desc: '高雅气质女｜适合：英语', aliyunVoiceId: 'longanya_v3', isSystem: true, category: '女声', supportedInV3Flash: true },
    { id: 'sys_Bella', title: 'Bella3.0·萌宝（干练女声）', desc: '精准干练女｜适合：普通话', aliyunVoiceId: 'loongbella_v3', isSystem: true, category: '女声', supportedInV3Flash: true },

    // ========== 基础男声 ==========
    { id: 'sys_Moon', title: '龙安朔·月白（率性男声）', desc: '干净清爽男｜适合：普通话', aliyunVoiceId: 'longanshuo_v3', isSystem: true, category: '男声', supportedInV3Flash: true },
    { id: 'sys_Kai', title: '龙安朗·凯（沉浸男声）', desc: '清爽利落男｜适合：普通话', aliyunVoiceId: 'longanlang_v3', isSystem: true, category: '男声', supportedInV3Flash: true },
    { id: 'sys_Arthur', title: '龙安昀·徐大爷（故事男声）', desc: '居家暖男｜适合：普通话', aliyunVoiceId: 'longanyun_v3', isSystem: true, category: '男声', supportedInV3Flash: true },
    { id: 'sys_Neil', title: '龙老伯·阿闻（新闻男声）', desc: '沧桑岁月爷｜适合：普通话', aliyunVoiceId: 'longlaobo_v3', isSystem: true, category: '男声', supportedInV3Flash: true },
    { id: 'sys_Vincent', title: '龙陕哥·田叔（烟嗓男声）', desc: '原味陕北男（也可普通话）｜适合：陕西话/普通话', aliyunVoiceId: 'longshange_v3', isSystem: true, category: '男声', supportedInV3Flash: true },
    { id: 'sys_Radio_Gol', title: '龙安闽·拉迪奥（足球解说）', desc: '清纯萝莉女（也可闽南话）｜适合：闽南话/普通话', aliyunVoiceId: 'longanmin_v3', isSystem: true, category: '男声', supportedInV3Flash: true },
    { id: 'sys_Ryan', title: '龙逸尘·甜茶（张力男声）', desc: '洒脱活力男｜适合：普通话', aliyunVoiceId: 'longyichen_v3', isSystem: true, category: '男声', supportedInV3Flash: true },
    { id: 'sys_Aiden', title: '龙安智·艾登（美语男声）', desc: '睿智轻熟男｜适合：英语', aliyunVoiceId: 'longanzhi_v3', isSystem: true, category: '男声', supportedInV3Flash: true },
    { id: 'sys_Nofish', title: '龙汪汪·不吃鱼（特色男声）', desc: '台湾少年音｜适合：普通话', aliyunVoiceId: 'longwangwang_v3', isSystem: true, category: '男声', supportedInV3Flash: true },
    { id: 'sys_Andre', title: '安德雷（磁性男声）', desc: '精准干练女（Bella3.0）｜适合：普通话', aliyunVoiceId: 'loongbella_v3', isSystem: true, category: '男声', supportedInV3Flash: true },

    // ========== 童声 ==========
    { id: 'sys_Mochi', title: '龙安宣·沙小弥（早慧童声）', desc: '经典直播女｜适合：普通话', aliyunVoiceId: 'longanxuan_v3', isSystem: true, category: '童声', supportedInV3Flash: true },
    { id: 'sys_Pip', title: '龙黛玉·顽屁小孩（淘气童声）', desc: '娇率才女音｜适合：普通话', aliyunVoiceId: 'longdaiyu_v3', isSystem: true, category: '童声', supportedInV3Flash: true },

    // ========== 方言（v3-flash 支持） ==========
    { id: 'sys_Rocky', title: '龙嘉欣·粤语阿强（粤语女声）', desc: '优雅粤语女｜适合：粤语', aliyunVoiceId: 'longjiaxin_v3', isSystem: true, category: '方言', supportedInV3Flash: true },
    { id: 'sys_Kiki', title: '龙嘉怡·粤语阿清（粤语女声）', desc: '知性粤语女｜适合：粤语', aliyunVoiceId: 'longjiayi_v3', isSystem: true, category: '方言', supportedInV3Flash: true },
    { id: 'sys_Laotie', title: '龙老铁（东北直率男）', desc: '东北直率男｜适合：东北话', aliyunVoiceId: 'longlaotie_v3', isSystem: true, category: '方言', supportedInV3Flash: true },
    { id: 'sys_Marcus', title: '龙陕哥（陕西话男声）', desc: '原味陕北男｜适合：陕西话', aliyunVoiceId: 'longshange_v3', isSystem: true, category: '方言', supportedInV3Flash: true },
    { id: 'sys_Roy', title: '龙安闽（闽南语女声）', desc: '清纯萝莉女｜适合：闽南语', aliyunVoiceId: 'longanmin_v3', isSystem: true, category: '方言', supportedInV3Flash: true },
    // 以下方言无 v3-flash 专属音色，降级到默认
    { id: 'sys_Jada', title: '上海-阿珍（上海话女声）', desc: '降级到龙安欢｜适合：上海话（建议复刻）', aliyunVoiceId: 'longanhuan', isSystem: true, category: '方言', supportedInV3Flash: true },
    { id: 'sys_Dylan', title: '北京-晓东（北京话男声）', desc: '降级到龙安洋｜适合：北京话（建议复刻）', aliyunVoiceId: 'longanyang', isSystem: true, category: '方言', supportedInV3Flash: true },
    { id: 'sys_Li', title: '南京-老李（南京话男声）', desc: '降级到龙安欢｜适合：南京话（建议复刻）', aliyunVoiceId: 'longanhuan', isSystem: true, category: '方言', supportedInV3Flash: true },
    { id: 'sys_Peter', title: '天津-李彼得（天津话男声）', desc: '降级到龙安洋｜适合：天津话（建议复刻）', aliyunVoiceId: 'longanyang', isSystem: true, category: '方言', supportedInV3Flash: true },
    { id: 'sys_Sunny', title: '四川-晴儿（四川话女声）', desc: '降级到龙安欢｜适合：四川话（建议复刻）', aliyunVoiceId: 'longanhuan', isSystem: true, category: '方言', supportedInV3Flash: true },
    { id: 'sys_Eric', title: '四川-程川（四川话男声）', desc: '降级到龙安洋｜适合：四川话（建议复刻）', aliyunVoiceId: 'longanyang', isSystem: true, category: '方言', supportedInV3Flash: true },

    // ========== 外语（v3-flash 支持：日语/韩语/英语） ==========
    { id: 'sys_Ono_Anna', title: '小野杏（日语女声）', desc: '日语女｜适合：日语', aliyunVoiceId: 'loongtomoka_v3', isSystem: true, category: '外语', supportedInV3Flash: true },
    { id: 'sys_Riko', title: 'Riko（日语二次元女声）', desc: '二次元霓虹女｜适合：日语', aliyunVoiceId: 'loongriko_v3', isSystem: true, category: '外语', supportedInV3Flash: true },
    { id: 'sys_Tomoya', title: 'Tomoya（日语男声）', desc: '日语男｜适合：日语', aliyunVoiceId: 'loongtomoya_v3', isSystem: true, category: '外语', supportedInV3Flash: true },
    { id: 'sys_Yuuna', title: 'Yuuna（日语元气女声）', desc: '元气霓虹女｜适合：日语', aliyunVoiceId: 'loongyuuna_v3', isSystem: true, category: '外语', supportedInV3Flash: true },
    { id: 'sys_Yuuma', title: 'Yuuma（日语干练男声）', desc: '干练霓虹男｜适合：日语', aliyunVoiceId: 'loongyuuma_v3', isSystem: true, category: '外语', supportedInV3Flash: true },
    { id: 'sys_Sohee', title: '素熙（韩语女声）', desc: '韩语女｜适合：韩语', aliyunVoiceId: 'loongkyong_v3', isSystem: true, category: '外语', supportedInV3Flash: true },
    { id: 'sys_Jihun', title: 'Jihun（韩语男声）', desc: '阳光韩国男｜适合：韩语', aliyunVoiceId: 'loongjihun_v3', isSystem: true, category: '外语', supportedInV3Flash: true },
    { id: 'sys_Abby', title: 'Abby（美式英语女声）', desc: '美式英文女｜适合：英语', aliyunVoiceId: 'loongabby_v3', isSystem: true, category: '外语', supportedInV3Flash: true },
    { id: 'sys_Andy', title: 'Andy（美式英语男声）', desc: '美式英文男｜适合：英语', aliyunVoiceId: 'loongandy_v3', isSystem: true, category: '外语', supportedInV3Flash: true },
    { id: 'sys_Annie', title: 'Annie（美式英语女声）', desc: '美式英文女｜适合：英语', aliyunVoiceId: 'loongannie_v3', isSystem: true, category: '外语', supportedInV3Flash: true },
    { id: 'sys_Ava', title: 'Ava（美式英语女声）', desc: '美式英文女｜适合：英语', aliyunVoiceId: 'loongava_v3', isSystem: true, category: '外语', supportedInV3Flash: true },
    { id: 'sys_Beth', title: 'Beth（美式英语女声）', desc: '美式英文女｜适合：英语', aliyunVoiceId: 'loongbeth_v3', isSystem: true, category: '外语', supportedInV3Flash: true },
    { id: 'sys_Betty', title: 'Betty（美式英语女声）', desc: '美式英文女｜适合：英语', aliyunVoiceId: 'loongbetty_v3', isSystem: true, category: '外语', supportedInV3Flash: true },
    { id: 'sys_Cally', title: 'Cally（美式英语女声）', desc: '美式英文女｜适合：英语', aliyunVoiceId: 'loongcally_v3', isSystem: true, category: '外语', supportedInV3Flash: true },
    { id: 'sys_Cindy', title: 'Cindy（美式英语女声）', desc: '美式英文女｜适合：英语', aliyunVoiceId: 'loongcindy_v3', isSystem: true, category: '外语', supportedInV3Flash: true },
    { id: 'sys_David', title: 'David（美式英语男声）', desc: '美式英文男｜适合：英语', aliyunVoiceId: 'loongdavid_v3', isSystem: true, category: '外语', supportedInV3Flash: true },
    { id: 'sys_Donna', title: 'Donna（美式英语女声）', desc: '美式英文女｜适合：英语', aliyunVoiceId: 'loongdonna_v3', isSystem: true, category: '外语', supportedInV3Flash: true },
    { id: 'sys_Emily', title: 'Emily（英式英语女声）', desc: '英式英文女｜适合：英语', aliyunVoiceId: 'loongemily_v3', isSystem: true, category: '外语', supportedInV3Flash: true },
    { id: 'sys_Eric', title: 'Eric（英式英语男声）', desc: '英式英文男｜适合：英语', aliyunVoiceId: 'loongeric_v3', isSystem: true, category: '外语', supportedInV3Flash: true },
    { id: 'sys_Luna', title: 'Luna（英式英语女声）', desc: '英式英文女｜适合：英语', aliyunVoiceId: 'loongluna_v3', isSystem: true, category: '外语', supportedInV3Flash: true },
    { id: 'sys_Luca', title: 'Luca（英式英语男声）', desc: '英式英文男｜适合：英语', aliyunVoiceId: 'loongluca_v3', isSystem: true, category: '外语', supportedInV3Flash: true },

    // ========== 外语（仅 v2 支持，v3-flash 不支持 → 标记不可用） ==========
    { id: 'sys_Bodega', title: '博德加（西语男声）', desc: '⚠️ 仅V2支持｜适合：西班牙语', aliyunVoiceId: 'loongeric_v2', isSystem: true, category: '外语', supportedInV3Flash: false },
    { id: 'sys_Sonrisa', title: '索尼莎（西语女声）', desc: '⚠️ 仅V2支持｜适合：西班牙语', aliyunVoiceId: 'loongemily_v2', isSystem: true, category: '外语', supportedInV3Flash: false },
    { id: 'sys_Alek', title: '阿列克（俄语男声）', desc: '⚠️ 仅V2支持｜适合：俄语', aliyunVoiceId: 'loongluca_v2', isSystem: true, category: '外语', supportedInV3Flash: false },
    { id: 'sys_Dolce', title: '多尔切（意语男声）', desc: '⚠️ 仅V2支持｜适合：意大利语', aliyunVoiceId: 'loongandy_v2', isSystem: true, category: '外语', supportedInV3Flash: false },
    { id: 'sys_Lenn', title: '莱恩（德语男声）', desc: '⚠️ 仅V2支持｜适合：德语', aliyunVoiceId: 'loongdavid_v2', isSystem: true, category: '外语', supportedInV3Flash: false },
    { id: 'sys_Emilien', title: '埃米尔安（法语男声）', desc: '⚠️ 仅V2支持｜适合：法语', aliyunVoiceId: 'loongbeth_v2', isSystem: true, category: '外语', supportedInV3Flash: false },

    // ========== 社交陪伴（龙系列） ==========
    { id: 'sys_Hua', title: '龙华（元气甜美女）', desc: '元气甜美女｜适合：普通话', aliyunVoiceId: 'longhua_v3', isSystem: true, category: '社交陪伴', supportedInV3Flash: true },
    { id: 'sys_Cheng', title: '龙橙（智慧青年男）', desc: '智慧青年男｜适合：普通话', aliyunVoiceId: 'longcheng_v3', isSystem: true, category: '社交陪伴', supportedInV3Flash: true },
    { id: 'sys_Ze', title: '龙泽（温暖元气男）', desc: '温暖元气男｜适合：普通话', aliyunVoiceId: 'longze_v3', isSystem: true, category: '社交陪伴', supportedInV3Flash: true },
    { id: 'sys_Zhe', title: '龙哲（呆板大暖男）', desc: '呆板大暖男｜适合：普通话', aliyunVoiceId: 'longzhe_v3', isSystem: true, category: '社交陪伴', supportedInV3Flash: true },
    { id: 'sys_Yan', title: '龙颜（温暖春风女）', desc: '温暖春风女｜适合：普通话', aliyunVoiceId: 'longyan_v3', isSystem: true, category: '社交陪伴', supportedInV3Flash: true },
    { id: 'sys_Xing', title: '龙星（温婉邻家女）', desc: '温婉邻家女｜适合：普通话', aliyunVoiceId: 'longxing_v3', isSystem: true, category: '社交陪伴', supportedInV3Flash: true },
    { id: 'sys_Wan', title: '龙婉（细腻柔声女）', desc: '细腻柔声女｜适合：普通话', aliyunVoiceId: 'longwan_v3', isSystem: true, category: '社交陪伴', supportedInV3Flash: true },
    { id: 'sys_Qiang', title: '龙嫱（浪漫风情女）', desc: '浪漫风情女｜适合：普通话', aliyunVoiceId: 'longqiang_v3', isSystem: true, category: '社交陪伴', supportedInV3Flash: true },
    { id: 'sys_Hao', title: '龙浩（多情忧郁男）', desc: '多情忧郁男｜适合：普通话', aliyunVoiceId: 'longhao_v3', isSystem: true, category: '社交陪伴', supportedInV3Flash: true },
    { id: 'sys_Anrou', title: '龙安柔（温柔闺蜜女）', desc: '温柔闺蜜女｜适合：普通话', aliyunVoiceId: 'longanrou_v3', isSystem: true, category: '社交陪伴', supportedInV3Flash: true },
    { id: 'sys_Han', title: '龙寒（温暖痴情男）', desc: '温暖痴情男｜适合：普通话', aliyunVoiceId: 'longhan_v3', isSystem: true, category: '社交陪伴', supportedInV3Flash: true },
    { id: 'sys_Antai', title: '龙安台（嗲甜台湾女）', desc: '嗲甜台湾女｜适合：普通话', aliyunVoiceId: 'longantai_v3', isSystem: true, category: '社交陪伴', supportedInV3Flash: true },

    // ========== 语音助手 ==========
    { id: 'sys_Xiaochun', title: '龙小淳（知性积极女）', desc: '知性积极女｜适合：普通话', aliyunVoiceId: 'longxiaochun_v3', isSystem: true, category: '语音助手', supportedInV3Flash: true },
    { id: 'sys_Xiaoxia', title: '龙小夏（沉稳权威女）', desc: '沉稳权威女｜适合：普通话', aliyunVoiceId: 'longxiaoxia_v3', isSystem: true, category: '语音助手', supportedInV3Flash: true },
    { id: 'sys_Yumi', title: 'YUMI（正经青年女）', desc: '正经青年女｜适合：普通话', aliyunVoiceId: 'longyumi_v3', isSystem: true, category: '语音助手', supportedInV3Flash: true },
    { id: 'sys_Anli', title: '龙安莉（利落从容女）', desc: '利落从容女｜适合：普通话', aliyunVoiceId: 'longanli_v3', isSystem: true, category: '语音助手', supportedInV3Flash: true },
    { id: 'sys_Yingmu', title: '龙应沐（优雅知性女）', desc: '优雅知性女｜适合：普通话', aliyunVoiceId: 'longyingmu_v3', isSystem: true, category: '语音助手', supportedInV3Flash: true },

    // ========== 客服 ==========
    { id: 'sys_Yingjing', title: '龙应静（低调冷静女）', desc: '低调冷静女｜适合：普通话', aliyunVoiceId: 'longyingjing_v3', isSystem: true, category: '客服', supportedInV3Flash: true },
    { id: 'sys_Yingling', title: '龙应聆（温和共情女）', desc: '温和共情女｜适合：普通话', aliyunVoiceId: 'longyingling_v3', isSystem: true, category: '客服', supportedInV3Flash: true },

    // ========== 有声书 ==========
    { id: 'sys_Miao', title: '龙妙（抑扬顿挫女）', desc: '抑扬顿挫女｜适合：普通话', aliyunVoiceId: 'longmiao_v3', isSystem: true, category: '有声书', supportedInV3Flash: true },
    { id: 'sys_Sanshu', title: '龙三叔（沉稳质感男）', desc: '沉稳质感男｜适合：普通话', aliyunVoiceId: 'longsanshu_v3', isSystem: true, category: '有声书', supportedInV3Flash: true },
    { id: 'sys_Yuan', title: '龙媛（温暖治愈女）', desc: '温暖治愈女｜适合：普通话', aliyunVoiceId: 'longyuan_v3', isSystem: true, category: '有声书', supportedInV3Flash: true },
    { id: 'sys_Yue', title: '龙悦（温暖磁性女）', desc: '温暖磁性女｜适合：普通话', aliyunVoiceId: 'longyue_v3', isSystem: true, category: '有声书', supportedInV3Flash: true },
    { id: 'sys_Xiu', title: '龙修（博才说书男）', desc: '博才说书男｜适合：普通话', aliyunVoiceId: 'longxiu_v3', isSystem: true, category: '有声书', supportedInV3Flash: true },
    { id: 'sys_Nan', title: '龙楠（睿智青年男）', desc: '睿智青年男｜适合：普通话', aliyunVoiceId: 'longnan_v3', isSystem: true, category: '有声书', supportedInV3Flash: true },

    // ========== 童声/智能玩具 ==========
    { id: 'sys_Paopao', title: '龙泡泡（飞天泡泡音）', desc: '飞天泡泡音｜适合：普通话', aliyunVoiceId: 'longpaopao_v3', isSystem: true, category: '童声', supportedInV3Flash: true },
    { id: 'sys_Jielidou', title: '龙杰力豆（阳光顽皮男）', desc: '阳光顽皮男｜适合：普通话', aliyunVoiceId: 'longjielidou_v3', isSystem: true, category: '童声', supportedInV3Flash: true },
    { id: 'sys_Xian', title: '龙仙（豪放可爱女）', desc: '豪放可爱女｜适合：普通话', aliyunVoiceId: 'longxian_v3', isSystem: true, category: '童声', supportedInV3Flash: true },
    { id: 'sys_Ling', title: '龙铃（稚气呆板女）', desc: '稚气呆板女｜适合：普通话', aliyunVoiceId: 'longling_v3', isSystem: true, category: '童声', supportedInV3Flash: true },
    { id: 'sys_Shanshan', title: '龙闪闪（戏剧化童声）', desc: '戏剧化童声｜适合：普通话', aliyunVoiceId: 'longshanshan_v3', isSystem: true, category: '童声', supportedInV3Flash: true },
    { id: 'sys_Niuniu', title: '龙牛牛（阳光男童声）', desc: '阳光男童声｜适合：普通话', aliyunVoiceId: 'longniuniu_v3', isSystem: true, category: '童声', supportedInV3Flash: true },

    // ========== 其他 ==========
    { id: 'sys_Anran', title: '龙安燃（活泼质感女）', desc: '活泼质感女｜适合：普通话', aliyunVoiceId: 'longanran_v3', isSystem: true, category: '其他', supportedInV3Flash: true },
    { id: 'sys_Fei', title: '龙飞（热血磁性男）', desc: '热血磁性男｜适合：普通话', aliyunVoiceId: 'longfei_v3', isSystem: true, category: '其他', supportedInV3Flash: true },
    { id: 'sys_Shuo', title: '龙硕（博才干练男）', desc: '博才干练男｜适合：普通话', aliyunVoiceId: 'longshuo_v3', isSystem: true, category: '其他', supportedInV3Flash: true },
    { id: 'sys_Sh', title: '龙书（沉稳青年男）', desc: '沉稳青年男｜适合：普通话', aliyunVoiceId: 'longshu_v3', isSystem: true, category: '其他', supportedInV3Flash: true },
];

/**
 * 简化版音色列表（用于选择器，不含 desc/isSystem/category）
 */
export const systemVoicesSimple: SystemVoiceSimple[] = systemVoices.map(v => ({
    id: v.id,
    title: v.title,
    aliyunVoiceId: v.aliyunVoiceId,
}));

/**
 * 系统音色 ID → aliyunVoiceId 映射表（用于 VideoIPAgent 等 TTS 调用）
 */
export const systemVoiceMapCosyvoice: Record<string, string> = Object.fromEntries(
    systemVoices.map(v => [v.id, v.aliyunVoiceId])
);

/**
 * 支持 Instruct（情绪控制）的系统音色列表
 * 参考：https://help.aliyun.com/document_detail/2712536.html
 * cosyvoice-v3-flash 仅以下3个系统音色支持 Instruct
 */
export const INSTRUCT_SUPPORTED_VOICES = ['longanyang', 'longanhuan', 'longhuhu_v3'];

/**
 * 判断某个音色是否支持情绪控制
 * @param voiceId aliyunVoiceId
 * @param isSystemVoice 是否系统音色
 */
export function isVoiceSupportInstruct(voiceId: string, isSystemVoice: boolean): boolean {
    if (!isSystemVoice) return true; // 复刻音色支持自然语言 Instruct
    return INSTRUCT_SUPPORTED_VOICES.includes(voiceId);
}

/**
 * 语言 → 系统(音色ID) 映射表
 * 用于检测语言选择与音色是否匹配，以及自动推荐匹配的音色
 *
 * 键名与 audioLanguageOptions 中的 value 保持一致
 */
export const LANGUAGE_VOICE_MAP: Record<string, string[]> = {
    // 普通话
    '中文': ['sys_Cherry', 'sys_Ethan', 'sys_Chelsie', 'sys_Momo', 'sys_Vivian', 'sys_Maia',
        'sys_Katerina', 'sys_Bellona', 'sys_Bunny', 'sys_Mia', 'sys_Nini', 'sys_Ebona', 'sys_Seren',
        'sys_Serena', 'sys_Bella', 'sys_Moon', 'sys_Kai', 'sys_Arthur', 'sys_Neil', 'sys_Ryan',
        'sys_Nofish', 'sys_Andre', 'sys_Mochi', 'sys_Pip', 'sys_Hua', 'sys_Cheng', 'sys_Ze',
        'sys_Zhe', 'sys_Yan', 'sys_Xing', 'sys_Wan', 'sys_Qiang', 'sys_Hao', 'sys_Anrou',
        'sys_Han', 'sys_Antai', 'sys_Xiaochun', 'sys_Xiaoxia', 'sys_Yumi', 'sys_Anli',
        'sys_Yingmu', 'sys_Yingjing', 'sys_Yingling', 'sys_Miao', 'sys_Sanshu', 'sys_Yuan',
        'sys_Yue', 'sys_Xiu', 'sys_Nan', 'sys_Paopao', 'sys_Jielidou', 'sys_Xian', 'sys_Ling',
        'sys_Shanshan', 'sys_Niuniu', 'sys_Anran', 'sys_Fei', 'sys_Shuo', 'sys_Sh',
        'sys_Vincent', 'sys_Radio_Gol', 'sys_Stella'],
    // 粤语
    '粤语': ['sys_Rocky', 'sys_Kiki', 'sys_Stella'],
    // 东北话
    '东北话': ['sys_Laotie'],
    // 陕西话
    '陕西话': ['sys_Marcus', 'sys_Vincent'],
    // 闽南语
    '闽南语': ['sys_Roy', 'sys_Radio_Gol'],
    // 上海话
    '上海话': ['sys_Jada'],
    // 北京话
    '北京话': ['sys_Dylan'],
    // 四川话
    '四川话': ['sys_Sunny', 'sys_Eric'],
    // 南京话
    '南京话': ['sys_Li'],
    // 天津话
    '天津话': ['sys_Peter'],
    // 英语
    '英语': ['sys_Jennifer', 'sys_Aiden', 'sys_Abby', 'sys_Andy', 'sys_Annie', 'sys_Ava',
        'sys_Beth', 'sys_Betty', 'sys_Cally', 'sys_Cindy', 'sys_David', 'sys_Donna',
        'sys_Emily', 'sys_Eric', 'sys_Luna', 'sys_Luca'],
    // 日语
    '日语': ['sys_Ono_Anna', 'sys_Riko', 'sys_Tomoya', 'sys_Yuuna', 'sys_Yuuma'],
    // 韩语
    '韩语': ['sys_Sohee', 'sys_Jihun'],
    // 法语（仅V2）
    '法语': ['sys_Emilien'],
    // 德语（仅V2）
    '德语': ['sys_Lenn'],
    // 俄语（仅V2）
    '俄语': ['sys_Alek'],
    // 意大利语（仅V2）
    '意大利语': ['sys_Dolce'],
    // 西班牙语（仅V2）
    '西班牙语': ['sys_Bodega', 'sys_Sonrisa'],
    // 葡萄牙语（无专属音色）
    '葡萄牙语': [],
};

/**
 * 系统(音色ID) → 语言 映射表（反向映射，自动从 LANGUAGE_VOICE_MAP 生成）
 */
export const VOICE_LANGUAGE_MAP: Record<string, string> = {};
for (const [lang, voiceIds] of Object.entries(LANGUAGE_VOICE_MAP)) {
    for (const voiceId of voiceIds) {
        // 一个音色可能对应多种语言（如普通话/粤语），取第一个出现的语言作为主语言
        if (!VOICE_LANGUAGE_MAP[voiceId]) {
            VOICE_LANGUAGE_MAP[voiceId] = lang;
        }
    }
}
// 特殊处理：同时支持普通话和粤语的音色
VOICE_LANGUAGE_MAP['sys_Vincent'] = '陕西话/普通话';
VOICE_LANGUAGE_MAP['sys_Radio_Gol'] = '闽南语/普通话';
VOICE_LANGUAGE_MAP['sys_Stella'] = '粤语/普通话';

/**
 * 获取系统音色的主语言
 * @param promptId 音色ID（如 sys_Ono_Anna）或用户自定义音色的 storage ID
 * @returns 语言名称，如 "日语"、"普通话" 等；无法判断时返回 undefined
 */
export function getVoiceLanguage(promptId: number | string): string | undefined {
    if (typeof promptId === 'string' && promptId.startsWith('sys_')) {
        return VOICE_LANGUAGE_MAP[promptId];
    }
    // 用户自定义音色无法自动判断语言
    return undefined;
}

/**
 * 检查语言与音色是否匹配
 * @param language 选择的语言（如 "日语"）
 * @param promptId 当前选中的音色ID
 * @returns true=匹配, false=不匹配, undefined=无法判断（用户自定义音色）
 */
export function isVoiceLanguageMatch(language: string, promptId: number | string): boolean | undefined {
    if (!language || language === '中文') {
        // 中文(普通话)是默认语言，几乎所有音色都兼容
        return true;
    }
    if (typeof promptId === 'string' && promptId.startsWith('sys_')) {
        const voiceLang = VOICE_LANGUAGE_MAP[promptId];
        if (!voiceLang) return undefined;
        // 检查音色语言是否包含所选语言（处理 "粤语/普通话" 这种多语言情况）
        return voiceLang.includes(language) || voiceLang.includes('普通话') && language === '中文';
    }
    // 用户自定义音色无法判断
    return undefined;
}

/**
 * 获取指定语言推荐的系统音色列表
 * @param language 语言名称
 * @returns 匹配该语言的系统音色ID数组
 */
export function getRecommendedVoicesForLanguage(language: string): string[] {
    return LANGUAGE_VOICE_MAP[language] || [];
}
