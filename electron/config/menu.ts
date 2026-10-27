import {app, Menu} from 'electron';
import {isDev, isMac} from '../lib/env';
import {AppRuntime} from '../mapi/env';

const command=(detail:string)=>()=>{
    const window=AppRuntime.mainWindow;
    if(!window||window.isDestroyed())return;
    window.webContents.executeJavaScript(`window.dispatchEvent(new CustomEvent('ipbot:command',{detail:${JSON.stringify(detail)}}))`).catch(console.error);
};
const route=(label:string,path:string):Electron.MenuItemConstructorOptions=>({label,click:command(path)});
const ready=()=>{
    const template:Electron.MenuItemConstructorOptions[]=[];
    if(isMac)template.push({label:app.name,submenu:[{role:'about',label:'关于 '+app.name},{type:'separator'},{label:'偏好设置…',accelerator:'CmdOrCtrl+,',click:command('/setting')},{type:'separator'},{role:'services'},{type:'separator'},{role:'hide'},{role:'hideOthers'},{role:'unhide'},{type:'separator'},{role:'quit',label:'退出'}]});
    template.push({label:'创作',submenu:[route('创作概览','/home'),route('创作工作台','/video?tab=ipAgent'),route('数字人形象','/video?tab=videoTemplate'),route('声音工作室','/sound'),route('素材资源','/video?tab=videoMaterial'),route('视频合成','/video?tab=videoGen'),{type:'separator'},{label:'封面设计（开发中）',enabled:false},{label:'图像创作（开发中）',enabled:false},route('字幕制作','/video-subtitle'),route('音频提取','/video?tab=videoAudioExtract'),{label:'互动直播（开发中）',enabled:false},{label:'实用工具（开发中）',enabled:false},{type:'separator'},route('模型服务','/server'),...(!isMac?[{label:'偏好设置…',accelerator:'CmdOrCtrl+,',click:command('/setting')},{type:'separator'} as Electron.MenuItemConstructorOptions,{role:'quit',label:'退出'} as Electron.MenuItemConstructorOptions]:[])]});
    template.push({label:'编辑',submenu:[{label:'撤销',role:'undo'},{label:'重做',role:'redo'},{type:'separator'},{label:'剪切',role:'cut'},{label:'复制',role:'copy'},{label:'粘贴',role:'paste'},{label:'全选',role:'selectAll'}]});
    template.push({label:'视图',submenu:[{label:'搜索页面…',accelerator:'CmdOrCtrl+K',click:command('search')},{label:'显示或隐藏侧栏',accelerator:'CmdOrCtrl+B',click:command('sidebar')},{type:'separator'},{label:'实际大小',role:'resetZoom'},{label:'放大',role:'zoomIn'},{label:'缩小',role:'zoomOut'},{label:'全屏',role:'togglefullscreen'},...(isDev?[{type:'separator'} as Electron.MenuItemConstructorOptions,{label:'重新加载',role:'reload'} as Electron.MenuItemConstructorOptions,{label:'开发者工具',role:'toggleDevTools'} as Electron.MenuItemConstructorOptions]:[])]});
    template.push({id:'workspace-commands',label:'工作台操作',submenu:[{label:'自动模式',click:command('agent-run')},{label:'停止任务',click:command('agent-stop')},{label:'智能体配置',click:command('agent-settings')},{type:'separator'},{label:'清空创作数据…',click:command('agent-reset')}]});
    const menu=Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
    const updateContext=()=>{
        const hash=(AppRuntime.mainWindow?.webContents.getURL()||'').split('#')[1]||'';
        const active=hash==='/video'||hash.startsWith('/video?tab=ipAgent');
        const commands=menu.getMenuItemById('workspace-commands');
        if(commands)commands.enabled=active;
    };
    updateContext();
    AppRuntime.mainWindow?.webContents.on('did-navigate-in-page',updateContext);
};
export const ConfigMenu={ready};
