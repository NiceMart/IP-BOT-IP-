<script setup lang="ts">
import { computed, nextTick, onBeforeMount, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PageNav from '../components/PageNav.vue';
import ThemeSwitch from '../components/ThemeSwitch.vue';
import CommandPalette from '../components/CommandPalette.vue';
import AppQuitConfirm from '../components/AppQuitConfirm.vue';
import { AppConfig } from '../config';
const route=useRoute(), router=useRouter();
const appQuitConfirm=ref<InstanceType<typeof AppQuitConfirm>|null>(null);
const palette=ref<InstanceType<typeof CommandPalette>|null>(null);
const isOsx=ref(false), isFullscreen=ref(false);
const sidebarHidden=ref(localStorage.getItem('ipbot.sidebarHidden')==='true');
const toggleSidebar=()=>{sidebarHidden.value=!sidebarHidden.value;localStorage.setItem('ipbot.sidebarHidden',String(sidebarHidden.value));};
const titles:Record<string,string>={'/home':'创作概览','/server':'模型服务','/sound':'声音工作室','/setting':'偏好设置','/tool':'实用工具','/live':'互动直播','/image':'图像创作','/design':'封面设计','/font-manager':'字体管理','/changelog':'更新记录','/video-subtitle':'字幕制作','/video-audio-extract':'音频提取','/video-publish':'视频发布'};
const videoTitles:Record<string,string>={ipAgent:'创作工作台',videoGen:'视频合成',videoTemplate:'数字人形象',videoMaterial:'素材资源',videoAudioExtract:'音频提取'};
const title=computed(()=>route.path==='/video'?(videoTitles[String(route.query.tab||'ipAgent')]||'视频工具'):(titles[route.path]||'创作空间'));
const onCommand=(event:Event)=>{
 const command=(event as CustomEvent).detail;
 if(command==='sidebar')toggleSidebar();
 else if(command==='search')palette.value?.show();
 else if(typeof command==='string'&&command.startsWith('/'))router.push(command);
};
const onKey=(e:KeyboardEvent)=>{
 if(!(e.ctrlKey||e.metaKey))return;
 if(e.key.toLowerCase()==='k'){e.preventDefault();palette.value?.show();}
 if(e.key===','){e.preventDefault();router.push('/setting');}
 if(e.key.toLowerCase()==='b'&&!/INPUT|TEXTAREA/.test((e.target as HTMLElement)?.tagName)){e.preventDefault();toggleSidebar();}
};
const resetScroll=async()=>{await nextTick();document.querySelectorAll('.app-route-host,.video-page-container > div').forEach(el=>el.scrollTo(0,0));};
watch(()=>route.fullPath,resetScroll);
onBeforeMount(()=>{isOsx.value=!!window.$mapi?.app?.isPlatform?.('osx');});
onMounted(()=>{document.addEventListener('keydown',onKey);window.addEventListener('ipbot:command',onCommand);resetScroll();});
onBeforeUnmount(()=>{document.removeEventListener('keydown',onKey);window.removeEventListener('ipbot:command',onCommand);});
if(typeof window.__page!=='undefined'){
 window.__page.onEnterFullScreen(()=>{isFullscreen.value=true;});
 window.__page.onLeaveFullScreen(()=>{isFullscreen.value=false;});
 window.__page.onShowQuitConfirmDialog(()=>appQuitConfirm.value?.show());
}
</script>
<template>
 <a class="skip-link" href="#main-content" @click.prevent="($refs.mainContent as HTMLElement)?.focus()">跳转到主要内容</a>
 <div class="window-container app-shell" :class="{'sidebar-hidden':sidebarHidden,fullscreen:isFullscreen}">
  <aside id="primary-sidebar" class="app-sidebar" aria-label="主导航" :inert="sidebarHidden || undefined">
   <div class="sidebar-brand"><img src="/logo.svg" alt="" class="sidebar-logo"/><div class="sidebar-brand-text"><strong>{{AppConfig.title||'IP Bot'}}</strong><span>创作空间</span></div></div>
   <PageNav/>
  </aside>
  <section class="app-main">
   <header class="app-topbar" :class="{osx:isOsx&&!isFullscreen}">
    <div class="topbar-context">
     <button type="button" class="shell-icon-button" :aria-label="sidebarHidden?'显示侧栏':'隐藏侧栏'" :title="(sidebarHidden?'显示侧栏':'隐藏侧栏')+' · Ctrl / ⌘ B'" :aria-expanded="!sidebarHidden" aria-controls="primary-sidebar" @click="toggleSidebar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/></svg></button>
     <span class="route-caption">{{title}}</span>
    </div>
    <div id="app-topbar-route-host" class="topbar-route-host"></div>
    <ThemeSwitch/>
    <button type="button" class="shell-icon-button command-trigger" aria-label="搜索页面和操作" title="搜索页面和操作 · Ctrl / ⌘ K" @click="palette?.show()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg></button>
    <div v-if="!isOsx && $mapi" class="window-controls" aria-label="窗口操作">
     <button type="button" aria-label="最小化窗口" title="最小化" @click="$mapi?.app?.windowMin?.()"><svg viewBox="0 0 16 16"><path d="M3 8h10"/></svg></button>
     <button type="button" aria-label="最大化或还原窗口" title="最大化或还原" @click="$mapi?.app?.windowMax?.()"><svg viewBox="0 0 16 16"><rect x="3.5" y="3.5" width="9" height="9" rx="1"/></svg></button>
     <button type="button" class="window-close" aria-label="关闭窗口" title="关闭" @click="appQuitConfirm?.show()"><svg viewBox="0 0 16 16"><path d="m4 4 8 8m0-8-8 8"/></svg></button>
    </div>
   </header>
   <main id="main-content" ref="mainContent" tabindex="-1" class="window-body app-content" :aria-label="title">
    <div class="app-route-host"><router-view v-slot="{Component,route:currentRoute}"><keep-alive :include="['Video','Server','Setting']" :max="5"><component :is="Component" :key="currentRoute.path"/></keep-alive></router-view></div>
   </main>
  </section>
 </div>
 <CommandPalette ref="palette"/>
 <AppQuitConfirm ref="appQuitConfirm"/>
</template>
<style scoped>
.app-shell{--app-sidebar-width:224px;display:flex!important;flex-direction:row;position:relative;width:100%;height:100dvh;overflow:hidden;background:var(--theme-app-bg)}
.app-sidebar{width:var(--app-sidebar-width);flex-shrink:0;display:flex;flex-direction:column;border-right:1px solid var(--theme-border);background:var(--studio-sidebar);min-height:0;z-index:30;overflow:hidden}
.sidebar-brand{display:flex;gap:12px;align-items:center;min-height:92px;padding:24px}.sidebar-logo{width:36px;height:36px;flex-shrink:0}.sidebar-brand-text{display:flex;flex-direction:column;gap:3px;min-width:0}.sidebar-brand-text strong{font-size:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sidebar-brand-text span{font-size:12px;color:var(--theme-text-muted)}
.app-main{flex:1;display:flex;flex-direction:column;min-width:0;min-height:0}.app-topbar{display:flex;align-items:center;gap:12px;min-height:64px;padding:10px 16px;border-bottom:1px solid var(--theme-border);background:var(--studio-surface)!important;-webkit-app-region:drag;z-index:12;flex-shrink:0}.app-topbar.osx{padding-left:80px}.topbar-context{display:flex;align-items:center;gap:10px;flex-shrink:0}.route-caption{font-size:14px;font-weight:600;color:var(--theme-text-primary)}.topbar-route-host{flex:1;min-width:0}.shell-icon-button{display:grid;place-items:center;min-width:36px;min-height:36px;border:1px solid transparent;border-radius:8px;color:var(--theme-text-secondary);background:transparent}.shell-icon-button:hover{background:var(--theme-panel-bg-muted);border-color:var(--theme-border)}.shell-icon-button svg{width:20px;height:20px}.window-controls{display:flex;align-self:stretch;margin:-10px -16px -10px 0}.window-controls button{width:40px;min-height:36px;display:grid;place-items:center;background:transparent;border:0;color:var(--theme-text-secondary)}.window-controls button:hover{background:var(--theme-panel-bg-muted)}.window-controls .window-close:hover{background:#b52d36;color:white}.window-controls svg{width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:1.2}.app-content{flex:1;min-height:0;overflow:hidden;padding:0!important}.app-route-host{height:100%;overflow:auto}.sidebar-hidden .app-sidebar{display:none}.sidebar-hidden{--app-sidebar-width:0px}
@media(max-width:1100px){.app-shell{--app-sidebar-width:80px}.sidebar-brand{justify-content:center;padding:24px 0}.sidebar-brand-text{display:none}.app-topbar{gap:6px;padding:8px 12px}.window-controls{margin:-8px -12px -8px 0}}
@media(max-width:760px){.app-topbar{flex-wrap:wrap}.topbar-context{flex:1}.topbar-route-host{order:4;width:100%;flex-basis:100%}.topbar-route-host:empty{display:none}.window-controls{margin:0}.route-caption{font-size:13px}.app-shell{--app-sidebar-width:72px}}
</style>
