(function(){const f={authorized:!1,fps60:!1,promoVideos:!1,hqUpload:!1,addSignature:!1,videoStats:!1,authorStats:!1,alive:!1,hqProcessed:!1,pendingUsageToken:null,usageCommitInFlight:!1};window.addEventListener("message",r=>{if(r.source!==window||r.data?.type!=="__EN_ACTIVE__")return;const s=r.data.features??{};f.authorized=!0,f.alive=!0,f.fps60=!!s.fps60,f.promoVideos=!!s.promoVideos,f.hqUpload=!!s.hqUpload,f.addSignature=!!s.addSignature,f.videoStats=!!s.videoStats,f.authorStats=!!s.authorStats});window.addEventListener("message",r=>{r.source!==window||r.data?.type!=="__EN_DEAD__"||(f.alive=!1)});window.addEventListener("change",r=>{const s=r.target;s.tagName==="INPUT"&&s.type==="file"&&s.files?.length&&!f.hqUpload&&(f.hqProcessed=!1)},!0);Te();function we(r,s){return new Promise((_,h)=>{const B=Math.random().toString(36).slice(2)+Date.now().toString(36),L=r.replace("REQUEST","RESPONSE");let m=!1;const v=I=>{I.source!==window||I.data?.type!==L||I.data?.id!==B||(m=!0,window.removeEventListener("message",v),I.data.success?_(I.data):h(new Error(I.data.error||"failed")))};window.addEventListener("message",v),window.postMessage({type:r,id:B,...s},"*"),setTimeout(()=>{m||(window.removeEventListener("message",v),h(new Error("timeout")))},3e4)})}async function he(){const r=f.pendingUsageToken;if(!(!r||f.usageCommitInFlight)){f.usageCommitInFlight=!0;try{const s=await we("__EN_PROCESS_COMMIT_REQUEST__",{token:r});s.success&&s.data?.success&&(f.pendingUsageToken=null)}catch(s){s.message==="USAGE_TOKEN_NOT_FOUND"&&(f.pendingUsageToken=null)}finally{f.usageCommitInFlight=!1}}}function Se(r){return typeof r=="string"?r:r&&typeof r.url=="string"?r.url:""}function fe(r){return Se(r).includes("project/post")}function be(r){if(typeof r=="number")return r===0;if(typeof r!="string")return null;const s=r.toLowerCase();return s==="0"||s==="ok"||s==="success"?!0:s==="1"||s==="error"||s==="failed"?!1:null}function ce(r){if(!r||typeof r!="object")return null;const s=r;if(typeof s.success=="boolean")return s.success;const _=be(s.status_code??s.statusCode??s.status??s.code);if(_!==null)return _;if(s.data&&typeof s.data=="object"){const h=s.data,B=be(h.status_code??h.statusCode??h.status??h.code);if(B!==null)return B;if(h.video_id||h.item_id||h.post_id||h.project_id)return!0}return null}async function Le(r){if(!r.ok)return!1;try{const s=ce(await r.clone().json());if(s!==null)return s}catch{}return!0}function Me(r){if(r.status<200||r.status>=300)return!1;try{if(r.response&&typeof r.response=="object"){const s=ce(r.response);if(s!==null)return s}}catch{}try{if(r.responseText){const s=ce(JSON.parse(r.responseText));if(s!==null)return s}}catch{}return!0}function me(){return!!(f.promoVideos||f.addSignature)}async function ve(r){if(!f.alive)throw new Error("session_terminated");const s={};f.promoVideos&&(s.promoVideos=!0),s.addSignature=!!f.addSignature,s.hqUpload=!!f.hqUpload,f.hqProcessed&&(s.hqProcessed=!0);const _=JSON.parse(r),h=await we("__EN_TRANSFORM_REQUEST__",{body:_,features:s});if(h.success&&h.data?.success&&h.data?.body)return JSON.stringify(h.data.body);throw new Error(h.error||h.data?.error||"transform_failed")}function Te(){const r=fetch,s=XMLHttpRequest.prototype.open,_=XMLHttpRequest.prototype.send;window.fetch=async function(h,B){const L=f.alive&&fe(h);if(L&&B?.body&&me())try{B.body=await ve(B.body)}catch(v){const I=v.message||"transform_failed";return new Response(JSON.stringify({status_code:1,status_msg:I}),{status:200,headers:{"Content-Type":"application/json"}})}const m=await r.apply(this,arguments);return L&&await Le(m)&&he(),m},XMLHttpRequest.prototype.open=function(h,B,L=!0,m,v){return this._url=B,s.call(this,h,B,L,m,v)},XMLHttpRequest.prototype.send=function(h){const B=f.alive&&fe(this._url);if(B){const L=this;L.addEventListener("loadend",()=>{Me(L)&&he()},{once:!0})}if(B&&typeof h=="string"&&me()){ve(h).then(L=>_.call(this,L)).catch(()=>this.dispatchEvent(new Event("error")));return}return _.call(this,h)}}const xe=URL.createObjectURL.bind(URL),Be=xe(new Blob([new Uint8Array(8)],{type:"application/octet-stream"}));URL.createObjectURL=function(r){return f.fps60&&r instanceof Blob&&r.type?.startsWith("video/")?Be:xe(r)};(function(){window.addEventListener("message",n=>{n.source!==window||n.data?.type!=="__EN_ACTIVE__"||n.data.features?.hqUpload&&(f.hqProcessed=!1)});const r=1024*1024,s=60,_=1e3,h=n=>n.type.startsWith("video/")||/\.(mp4|mov|avi|mkv|webm)$/i.test(n.name);let B=!1,L=50;const m=navigator.language.toLowerCase().startsWith("ru")?"ru":"en",v={processing:m==="ru"?"Обработка видео...":"Processing video...",doNotClose:m==="ru"?"Не закрывайте вкладку":"Do not close this tab",fileTooLarge:m==="ru"?"Файл слишком большой":"File too large",maxSize:m==="ru"?"макс":"max",upgradeLimit:m==="ru"?"Premium увеличивает лимит до 90 MB":"Premium increases the limit to 90 MB",videoTooLong:m==="ru"?"Видео длиннее 60 секунд":"Video is longer than 60 seconds",processingError:m==="ru"?"Ошибка обработки":"Processing error",serverError:m==="ru"?"Сервер недоступен":"Server unavailable",networkError:m==="ru"?"Ошибка сети":"Network error",timeout:m==="ru"?"Превышено время ожидания":"Request timeout",tryAgain:m==="ru"?"Попробуйте снова":"Please try again",retrying:m==="ru"?"Повтор попытки...":"Retrying..."};function I(n){if(n==="network_error"||n.includes("network")||n.startsWith("transcoder_error"))return!0;const l=n.match(/^HTTP_(\d+)$/);if(l){const g=Number(l[1]);return g>=500&&g!==501&&g!==505}return!1}function D(n){return n==="timeout"?v.timeout:n.startsWith("FILE_TOO_LARGE")||n==="HTTP_413"?Z():n==="session_terminated"||n==="NO_SESSION"||n.startsWith("HTTP_")?v.serverError:n==="process_failed"||n==="decode_error"||n==="read_error"||n.startsWith("transcode_")?v.processingError:n.includes("network")||n.includes("fetch")||n==="network_error"?v.networkError:v.processingError}function Z(){const n=`${v.fileTooLarge} (${v.maxSize} ${L} MB)`;return B?n:`${n}. ${v.upgradeLimit}`}window.addEventListener("message",n=>{if(n.source!==window||n.data?.type!=="__EN_SETTINGS__")return;const l=n.data.settings||{};B=!!(l.hasPartnerAccess||l.isPartner||l.isPremium),l.maxFileSizeMB&&(L=l.maxFileSizeMB)}),window.postMessage({type:"__EN_GET_SETTINGS__"},"*");function J(n){return new Promise(l=>{const g=document.createElement("video"),p=URL.createObjectURL(n);let x=!1;const S=(T=!1)=>{x||(x=!0,URL.revokeObjectURL(p),l(T))},w=setTimeout(()=>S(!1),5e3);g.preload="metadata",g.onloadedmetadata=()=>{clearTimeout(w),S(g.duration>s)},g.onerror=()=>{clearTimeout(w),S()},g.src=p})}function Q(n){return new Promise(l=>setTimeout(l,n))}const H=n=>Math.max(0,Math.min(100,Number.isFinite(n)?n:0));function j(n){return n==null||!Number.isFinite(n)?"":n<=0?"0 KB":n>=r?`${(n/r).toFixed(1)} MB`:`${Math.max(1,Math.round(n/1024))} KB`}function M(n){if(!n||!Number.isFinite(n)||n<1)return"";const l=Math.ceil(n),g=Math.floor(l/3600),p=Math.floor(l%3600/60),x=l%60;return`${String(g).padStart(2,"0")}:${String(p).padStart(2,"0")}:${String(x).padStart(2,"0")}`}function C(){let n=0,l=performance.now(),g=0;return p=>{const x=performance.now(),S=Math.max(0,Number(p.loaded||0)),w=Math.max(0,Number(p.total||0)),T=Math.max(0,(x-l)/1e3),t=S-n;if(T>0&&t>0){const c=t/T;g=g?g*.7+c*.3:c}n=S,l=x;const i=H(Number(p.percent??(w?S/w*100:0))),a=w&&g>0&&S<w?(w-S)/g:0;return{loaded:S,total:w,percent:i,eta:M(a)}}}function k(n){const l=[];return n.total?l.push(`${j(n.loaded)} / ${j(n.total)}`):n.loaded&&l.push(j(n.loaded)),n.eta&&l.push(n.eta),l.join(" · ")}function G(n,l,g=6e5,p){return new Promise((x,S)=>{const w=Math.random().toString(36).slice(2)+Date.now().toString(36),T=n.replace("REQUEST","RESPONSE"),t=n.replace("REQUEST","PROGRESS"),i=setTimeout(()=>{window.removeEventListener("message",a),S(new Error("timeout"))},g),a=c=>{if(c.source===window&&c.data?.id===w){if(c.data?.type===t){p?.(c.data);return}c.data?.type===T&&(clearTimeout(i),window.removeEventListener("message",a),c.data.success?x(c.data):S(new Error(c.data.error||"process_failed")))}};window.addEventListener("message",a),window.postMessage({type:n,id:w,...l},"*")})}async function ee(n,l){let g=0;const p=a=>{const c=typeof a=="number"?{percent:a}:a;g=Math.max(g,H(c.percent)),l?.({...c,percent:Math.round(g)})};p({percent:2,label:"Starting upload...",subtitle:""});const x=C(),w=(await G("__EN_PROC_START_REQUEST__",{file:n,filename:n.name},6e5,a=>{const c=x(a);p({percent:2+c.percent*.16,label:"Uploading to server",subtitle:k(c)})})).job_id;if(!w)throw new Error("process_failed");p({percent:18,label:"Queued",subtitle:""});const T=360;for(let a=0;a<T;a++){const c=await G("__EN_PROC_STATUS_REQUEST__",{jobId:w},6e4),b=Number(c.status_code||0);if(b===400||b===500)throw new Error(c.status_msg||`transcode_${b}`);if(b===10)p({percent:18,label:"Queued",subtitle:""});else if(b===20)p({percent:24,label:"Analyzing video",subtitle:""});else if(b===30){const P=H(Number(c.progress?.percent??0)),A=[];c.progress?.eta&&A.push(c.progress.eta),p({percent:30+P*.58,label:"Encoding video",subtitle:A.join(" · ")})}else b===40?p({percent:92,label:"Patching video",subtitle:""}):b===200&&p({percent:96,label:"Preparing result",subtitle:""});if(b===200)break;if(a===T-1)throw new Error("timeout");await Q(_)}p({percent:96,label:"Downloading result",subtitle:""});const t=C(),i=await G("__EN_PROC_RESULT_REQUEST__",{jobId:w},6e5,a=>{const c=t(a);p({percent:96+c.percent*.04,label:"Downloading from server",subtitle:k(c)})});if(!i.buffer)throw new Error("process_failed");return p({percent:100,label:"Done",subtitle:""}),{buffer:i.buffer,usageToken:i.usageToken}}function E(n,l){const g=new File([l],n.name,{type:n.type||"video/mp4",lastModified:n.lastModified});return new Uint8Array(l).fill(0),g}function te(){return document.querySelector('[data-e2e="select_video_container"]')||document.querySelector(".upload-card")}function Y(){if(document.getElementById("__en_hq_styles__"))return;const n=document.createElement("style");n.id="__en_hq_styles__",n.textContent=`
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

      #__en_hq_overlay__ {
        position: absolute; inset: 0; z-index: 999;
        display: flex; align-items: center; justify-content: center;
        border-radius: 16px;
        background: radial-gradient(ellipse at 50% 50%, rgba(4,14,8,0.98) 0%, rgba(8,10,9,0.99) 100%);
        opacity: 0; transition: opacity 0.3s ease;
        font-family: 'Inter', -apple-system, sans-serif;
      }
      #__en_hq_overlay__.--err {
        background: radial-gradient(ellipse at 50% 50%, rgba(14,5,5,0.98) 0%, rgba(10,8,8,0.99) 100%);
      }
      #__en_hq_overlay__ .__en_glow {
        position: absolute; width: 320px; height: 320px; border-radius: 50%;
        background: radial-gradient(circle, rgba(34,197,94,0.05) 0%, rgba(34,197,94,0.02) 40%, transparent 75%);
        pointer-events: none; filter: blur(20px); z-index: 0;
      }
      #__en_hq_overlay__.--err .__en_glow {
        background: radial-gradient(circle, rgba(239,68,68,0.05) 0%, rgba(239,68,68,0.02) 40%, transparent 75%);
      }
      #__en_hq_overlay__ .__en_badge {
        position: absolute; top: 14px; right: 14px; z-index: 10;
        display: flex; align-items: center; gap: 6px;
        padding: 5px 10px; border-radius: 6px;
        background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
      }
      #__en_hq_overlay__ .__en_badge span {
        font-size: 11px; font-weight: 500;
        color: rgba(255,255,255,0.25); letter-spacing: 0.2px;
      }
      #__en_hq_overlay__ .__en_content {
        position: relative; z-index: 5;
        display: flex; flex-direction: column; align-items: center; gap: 16px;
      }
      #__en_hq_overlay__ .__en_ring_wrap { position: relative; width: 88px; height: 88px; }
      #__en_hq_overlay__ .__en_ring_wrap > svg { position: absolute; inset: 0; transform: rotate(-90deg); }
      #__en_hq_overlay__ .__en_ring_inner {
        position: absolute; inset: 0;
        display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
      }
      #__en_hq_overlay__ .__en_ring_inner svg { filter: drop-shadow(0 0 6px rgba(34,197,94,0.5)); }
      #__en_hq_overlay__ .__en_pct { font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.4); letter-spacing: 0.3px; }
      #__en_hq_overlay__ .__en_label {
        font-size: 14px; font-weight: 500; color: rgba(255,255,255,0.78); letter-spacing: -0.1px;
        max-width: 240px; line-height: 1.35; text-align: center;
      }
      #__en_hq_overlay__ .__en_sub {
        font-size: 11px; font-weight: 400; color: rgba(255,255,255,0.42); letter-spacing: 0.2px;
        font-variant-numeric: tabular-nums; margin-top: 4px; min-height: 14px; text-align: center;
      }
      #__en_hq_overlay__ .__en_chip {
        display: inline-flex; align-items: center; gap: 7px; padding: 6px 12px; border-radius: 6px;
        background: rgba(255,185,0,0.05); border: 1px solid rgba(255,185,0,0.13);
      }
      #__en_hq_overlay__ .__en_chip span {
        font-size: 11px; font-weight: 500; color: rgba(255,185,0,0.45); letter-spacing: 0.2px;
      }
      #__en_hq_overlay__ .__en_err_icon {
        width: 56px; height: 56px; border-radius: 50%;
        background: rgba(239,68,68,0.07); border: 1px solid rgba(239,68,68,0.16);
        display: flex; align-items: center; justify-content: center;
      }
      #__en_hq_overlay__ .__en_err_icon svg { filter: drop-shadow(0 0 6px rgba(239,68,68,0.45)); }
      #__en_hq_overlay__ .__en_err_title {
        font-size: 14px; font-weight: 500; color: rgba(255,255,255,0.65);
        text-align: center; max-width: 260px; line-height: 1.35;
      }
      #__en_hq_overlay__ .__en_err_sub { font-size: 12px; font-weight: 400; color: rgba(255,255,255,0.28); margin-top: -6px; }
      @keyframes __en_arc_transition { from { stroke-dashoffset: var(--from); } to { stroke-dashoffset: var(--to); } }
    `,(document.head||document.documentElement).appendChild(n)}function X(n,l,g){Y();let p=document.getElementById("__en_hq_overlay__");p||(p=document.createElement("div"),p.id="__en_hq_overlay__"),p.innerHTML="",p.className=n==="error"?"--err":"";const x=document.createElement("div");x.className="__en_glow",p.appendChild(x);const S=document.createElement("div");S.className="__en_badge",S.innerHTML='<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg><span>TikTok Enhancer</span>',p.appendChild(S);const w=document.createElement("div");if(w.className="__en_content",n==="loading"){const T=2*Math.PI*38,t=g||0,i=T-T*t/100,a=document.createElement("div");a.className="__en_ring_wrap",a.innerHTML=`
        <svg width="88" height="88" viewBox="0 0 88 88">
          <defs><filter id="__en_gf__" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
          <circle cx="44" cy="44" r="38" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="3"/>
          <circle id="__en_arc_glow__" cx="44" cy="44" r="38" fill="none" stroke="rgba(34,197,94,0.22)" stroke-width="6" stroke-linecap="round" filter="url(#__en_gf__)" stroke-dasharray="${T}" stroke-dashoffset="${i}" style="transition:stroke-dashoffset 0.4s cubic-bezier(0.4,0,0.2,1)"/>
          <circle id="__en_arc_main__" cx="44" cy="44" r="38" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="${T}" stroke-dashoffset="${i}" style="transition:stroke-dashoffset 0.4s cubic-bezier(0.4,0,0.2,1)"/>
        </svg>
        <div class="__en_ring_inner">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <span id="__en_pct__" class="__en_pct">${t}%</span>
        </div>`,w.appendChild(a);const c=document.createElement("div");c.id="__en_label__",c.className="__en_label",c.textContent=v.processing,w.appendChild(c);const b=document.createElement("div");b.id="__en_sub__",b.className="__en_sub",w.appendChild(b);const P=document.createElement("div");P.className="__en_chip",P.innerHTML=`<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,185,0,0.45)" stroke-width="2.5" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg><span>${v.doNotClose}</span>`,w.appendChild(P)}else{const T=document.createElement("div");T.className="__en_err_icon",T.innerHTML='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',w.appendChild(T);const t=document.createElement("div");t.className="__en_err_title",t.textContent=l||v.processingError,w.appendChild(t);const i=document.createElement("div");i.className="__en_err_sub",i.textContent=v.tryAgain,w.appendChild(i),setTimeout(()=>{p.parentElement&&(p.style.opacity="0",setTimeout(()=>{p.remove(),R=!1},400))},2e3)}return p.appendChild(w),p}function z(n,l,g){const p=te();if(!p)return null;const x=X(n,l,g);return x.parentElement||(p.style.position="relative",p.appendChild(x)),requestAnimationFrame(()=>{x.style.opacity="1"}),x}function F(n){const l=typeof n=="number"?{percent:n}:n,g=H(l.percent),p=Math.round(g),x=2*Math.PI*38,S=`${x-x*g/100}`,w=document.getElementById("__en_arc_main__"),T=document.getElementById("__en_arc_glow__"),t=document.getElementById("__en_pct__"),i=document.getElementById("__en_label__"),a=document.getElementById("__en_sub__");if(w&&w.setAttribute("stroke-dashoffset",S),T&&T.setAttribute("stroke-dashoffset",S),t&&(t.textContent=`${p}%`),a&&l.subtitle!==void 0&&(a.textContent=l.subtitle),i){if(l.label){i.textContent=l.label;return}g<20?i.textContent=m==="ru"?"Чтение файла":"Reading file":g<35?i.textContent=m==="ru"?"Загрузка":"Uploading":g<90?i.textContent=m==="ru"?"Обработка видео":"Processing video":g<100?i.textContent=m==="ru"?"Почти готово":"Almost done":i.textContent=m==="ru"?"Готово":"Done"}}function V(){const n=document.getElementById("__en_hq_overlay__");n&&(n.style.opacity="0",setTimeout(()=>n.remove(),300))}let q=!1,O=!1,U=!1,R=!1;window.addEventListener("click",n=>{if(!q&&!R||!f.hqUpload)return;const l=n.target;(l.closest('[data-e2e="select_video_container"]')||l.closest('[data-e2e="select_video_button"]')||l.closest('div[role="button"]'))&&(n.stopImmediatePropagation(),n.preventDefault())},!0);async function W(n){let l=new Error("process_failed");for(let g=0;g<3;g++){if(g>0){const p=document.getElementById("__en_label__");p&&(p.textContent=v.retrying),await Q(2500)}try{return await ee(n,F)}catch(p){if(l=p,g<2&&I(l.message))continue;throw l}}throw l}window.addEventListener("change",async n=>{if(O){O=!1;return}if(!f.hqUpload)return;const l=n.target;if(l.tagName!=="INPUT"||l.type!=="file"||!l.files?.length)return;f.hqProcessed=!1,f.pendingUsageToken=null;const g=l.files[0];if(!(!h(g)||q||R)){n.stopImmediatePropagation(),q=!0,R=!0,z("loading",void 0,0);try{if(g.size>L*r){z("error",Z());try{l.value=""}catch{}return}if(await J(g)){z("error",v.videoTooLong);try{l.value=""}catch{}return}const p=await W(g);F(100);const x=E(g,p.buffer),S=new DataTransfer;S.items.add(x);const w=l.isConnected?l:document.querySelector('input[type="file"]');if(!w)throw new Error("input_lost");w.files=S.files,f.hqProcessed=!0,f.pendingUsageToken=p.usageToken||null,O=!0,V(),R=!1,w.dispatchEvent(new Event("change",{bubbles:!0}))}catch(p){z("error",D(p.message));try{l.value=""}catch{}}finally{q=!1}}},!0),window.addEventListener("drop",async n=>{if(U){U=!1;return}if(!f.hqUpload)return;const l=n.dataTransfer;if(!l?.files?.length)return;f.hqProcessed=!1,f.pendingUsageToken=null;const g=l.files[0];if(!h(g)||q||R)return;n.stopImmediatePropagation(),n.preventDefault(),q=!0,R=!0,z("loading",void 0,0);const p=n.target;try{if(g.size>L*r){z("error",Z());return}if(await J(g)){z("error",v.videoTooLong);return}const x=await W(g);F(100);const S=E(g,x.buffer),w=new DataTransfer;w.items.add(S),f.hqProcessed=!0,f.pendingUsageToken=x.usageToken||null;const T=p.isConnected?p:document.querySelector('[data-e2e="upload-card"]')??document.body;U=!0,V(),R=!1,T.dispatchEvent(new DragEvent("drop",{bubbles:!0,cancelable:!0,dataTransfer:w}))}catch(x){z("error",D(x.message))}finally{q=!1}},!0),window.addEventListener("dragover",n=>n.preventDefault(),!0)})();let le=!1;(function(){let r={language:"en",theme:"dark",features:{}},s=null,_=!1,h=null,B=!1,L=!1,m=null,v=null,I=null;document.addEventListener("visibilitychange",()=>{!document.hidden&&L&&_&&(L=!1,j())});const D=(e=document)=>{const d=e.querySelector('div[id^="xgwrapper-"]');if(!d)return null;const o=d.id.match(/^xgwrapper-\d+-(.+)$/)?.[1];if(!o)return null;const y=e.querySelector('a[href*="/@"]')?.getAttribute("href")?.match(/\/@([^\/?]+)/)?.[1]??location.pathname.match(/\/@([^\/?]+)/)?.[1];return y?`https://www.tiktok.com/@${y}/video/${o}`:null},Z=e=>e.querySelector('[class*="ActionBarContainer"]'),J=e=>!!e.querySelector('[data-e2e="ad-tag"], [data-e2e="ad-label"]'),Q=()=>!!document.querySelector('[data-e2e="ad-tag"], [data-e2e="ad-label"]'),H=()=>{const e=document.querySelector('[data-e2e="browse-username"]')?.closest('[class*="DivInfo"]')||document.querySelector('[data-e2e="browse-username"]')?.parentElement;if(e){const d=e.textContent||"";if(/Private|Friends|Приватн|Для друзей/i.test(d))return!0}return!1},j=async()=>{const e=document.getElementById("en-stats-panel");if(!(!e||e.classList.contains("hidden")||B||!m)){B=!0,e.innerHTML=`<div class="en-stats-hdr"><span class="en-stats-hdr-title">${E.stats} ${k("title")}</span></div><div class="en-stats-loading">${k("loading")}</div>`;try{const d=await U(m);s=d,_=!0,e.innerHTML=g(d),l(e)}catch{e.innerHTML=`<div class="en-stats-hdr"><span class="en-stats-hdr-title">${E.stats} ${k("title")}</span></div><div class="en-stats-error">${k("error")}</div>`}B=!1}},M=()=>{document.getElementById("en-stats-panel")?.remove(),document.getElementById("en-stats-style")?.remove(),document.querySelectorAll(".en-stats-action-btn").forEach(e=>e.remove()),h&&(h.pause(),h=null),I&&(I.disconnect(),I=null),s=null,_=!1,m=null,v=null,f.videoStats=!1,le=!1};window.addEventListener("message",e=>{if(e.source!==window||e.data?.type!=="__EN_SETTINGS__"||!f.authorized)return;const d=r.language,o=r.features?.enhancedStats,u=r.features?.videoStats;if(r={...r,...e.data.settings},u&&!r.features?.videoStats){M();return}if(!u&&r.features?.videoStats&&f.videoStats){b();return}W(),o!==r.features?.enhancedStats&&_?document.hidden?L=!0:j():d!==r.language&&(document.querySelectorAll(".en-stats-action-btn-label").forEach(y=>{y.textContent=k("buttonLabel")}),s&&_&&n())}),window.postMessage({type:"__EN_GET_SETTINGS__"},"*");const C={en:{title:"Video Stats",buttonLabel:"Stats",loading:"Loading...",error:"Failed to load stats",sponsored:"Sponsored",views:"Views",likes:"Likes",comments:"Comments",shares:"Shares",saves:"Saves",downloads:"Downloads",details:"Video Details",duration:"Duration",size:"Size",video:"Video",sound:"Sound",original:"Original",downloadOriginal:"Download Original",downloadingOriginal:"Downloading..."},ru:{title:"Статистика",buttonLabel:"Статс",loading:"Загрузка...",error:"Ошибка загрузки",sponsored:"Реклама",views:"Просмотры",likes:"Лайки",comments:"Комменты",shares:"Репосты",saves:"Сохранения",downloads:"Скачивания",details:"Детали видео",duration:"Длительность",size:"Размер",video:"Видео",sound:"Звук",original:"Оригинал",downloadOriginal:"Скачать оригинал",downloadingOriginal:"Загрузка..."}},k=e=>C[r.language]?.[e]||C.en[e]||e,G={en:{AF:"Afghanistan",AL:"Albania",DZ:"Algeria",AR:"Argentina",AM:"Armenia",AU:"Australia",AT:"Austria",AZ:"Azerbaijan",BD:"Bangladesh",BY:"Belarus",BE:"Belgium",BR:"Brazil",BG:"Bulgaria",CA:"Canada",CL:"Chile",CN:"China",CO:"Colombia",HR:"Croatia",CZ:"Czechia",DK:"Denmark",EG:"Egypt",EE:"Estonia",FI:"Finland",FR:"France",GE:"Georgia",DE:"Germany",GR:"Greece",HK:"Hong Kong",HU:"Hungary",IN:"India",ID:"Indonesia",IR:"Iran",IQ:"Iraq",IE:"Ireland",IL:"Israel",IT:"Italy",JP:"Japan",KZ:"Kazakhstan",KR:"South Korea",LV:"Latvia",LT:"Lithuania",MY:"Malaysia",MX:"Mexico",NL:"Netherlands",NZ:"New Zealand",NG:"Nigeria",NO:"Norway",PK:"Pakistan",PH:"Philippines",PL:"Poland",PT:"Portugal",RO:"Romania",RU:"Russia",SA:"Saudi Arabia",RS:"Serbia",SG:"Singapore",SK:"Slovakia",ZA:"South Africa",ES:"Spain",SE:"Sweden",CH:"Switzerland",TW:"Taiwan",TH:"Thailand",TR:"Turkey",UA:"Ukraine",AE:"UAE",GB:"UK",US:"USA",UZ:"Uzbekistan",VN:"Vietnam"},ru:{AF:"Афганистан",AL:"Албания",DZ:"Алжир",AR:"Аргентина",AM:"Армения",AU:"Австралия",AT:"Австрия",AZ:"Азербайджан",BD:"Бангладеш",BY:"Беларусь",BE:"Бельгия",BR:"Бразилия",BG:"Болгария",CA:"Канада",CL:"Чили",CN:"Китай",CO:"Колумбия",HR:"Хорватия",CZ:"Чехия",DK:"Дания",EG:"Египет",EE:"Эстония",FI:"Финляндия",FR:"Франция",GE:"Грузия",DE:"Германия",GR:"Греция",HK:"Гонконг",HU:"Венгрия",IN:"Индия",ID:"Индонезия",IR:"Иран",IQ:"Ирак",IE:"Ирландия",IL:"Израиль",IT:"Италия",JP:"Япония",KZ:"Казахстан",KR:"Южная Корея",LV:"Латвия",LT:"Литва",MY:"Малайзия",MX:"Мексика",NL:"Нидерланды",NZ:"Новая Зеландия",NG:"Нигерия",NO:"Норвегия",PK:"Пакистан",PH:"Филиппины",PL:"Польша",PT:"Португалия",RO:"Румыния",RU:"Россия",SA:"Саудовская Аравия",RS:"Сербия",SG:"Сингапур",SK:"Словакия",ZA:"ЮАР",ES:"Испания",SE:"Швеция",CH:"Швейцария",TW:"Тайвань",TH:"Таиланд",TR:"Турция",UA:"Украина",AE:"ОАЭ",GB:"Великобритания",US:"США",UZ:"Узбекистан",VN:"Вьетнам"}},ee=e=>G[r.language]?.[e?.toUpperCase()]||G.en[e?.toUpperCase()]||e,E={stats:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>',x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',play:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3"/></svg>',pause:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/></svg>',heart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',msg:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>',share:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" x2="12" y1="2" y2="15"/></svg>',bookmark:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>',download:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>',clock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',globe:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>',music:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',calendar:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>',video:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m10 11 5 3-5 3v-6Z"/></svg>',hdd:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" x2="2" y1="12" y2="12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><line x1="6" x2="6.01" y1="16" y2="16"/><line x1="10" x2="10.01" y1="16" y2="16"/></svg>',ad:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>',eye:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>',sparkle:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>'},te=`
    @keyframes enFadeIn { from { opacity: 0; transform: scale(0.97) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
    @keyframes enLightSwipe {
      0% { background-position: 200% center; }
      100% { background-position: -200% center; }
    }

    /* Inline action button in TikTok action bar */
    .en-stats-action-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      padding: 0;
      margin-top: 4px;
    }
    .en-stats-action-btn:active { transform: scale(0.9); }
    .en-stats-action-btn-icon {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.08);
      display: flex;
      align-items: center;
      justify-content: center;
      color: rgba(255, 255, 255, 0.9);
      transition: all 0.2s ease;
      border: none;
      cursor: pointer;
      padding: 0;
      position: relative;
      overflow: hidden;
    }
    .en-stats-action-btn-icon:hover { background: rgba(255, 255, 255, 0.18); color: #fff; }
    .en-stats-action-btn-icon svg { width: 24px; height: 24px; position: relative; z-index: 1; }
    .en-stats-action-btn.en-light-swipe .en-stats-action-btn-icon::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      background: linear-gradient(105deg, transparent 20%, rgba(255,255,255,0.45) 45%, rgba(255,255,255,0.6) 50%, rgba(255,255,255,0.45) 55%, transparent 80%);
      background-size: 250% 100%;
      animation: enLightSwipe 1.8s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    }
    .en-stats-action-btn-label {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.75);
      margin-top: 2px;
      font-weight: 700;
      line-height: 17px;
      font-family: TikTokFont, Arial, Tahoma, PingFangSC, sans-serif;
    }

    /* Panel */
    .en-stats-panel {
      position: fixed;
      width: 340px;
      max-height: 85vh;
      background: rgba(10, 10, 14, 0.88);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border-radius: 20px;
      border: 1px solid rgba(255,255,255,0.08);
      z-index: 9998;
      font-family: 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif;
      font-weight: 500;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      color: #fff;
      overflow: hidden;
      animation: enFadeIn 0.2s ease;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04);
    }
    .en-stats-panel.hidden { display: none; }

    /* Header */
    .en-stats-hdr {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 18px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .en-stats-hdr-title {
      font-size: 14px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
      color: rgba(255,255,255,0.92);
      font-family: 'Space Grotesk', 'Manrope', sans-serif;
      letter-spacing: -0.028em;
    }
    .en-stats-hdr-title svg { width: 16px; height: 16px; opacity: 0.55; }
    .en-stats-hdr-close {
      width: 28px;
      height: 28px;
      border-radius: 10px;
      background: rgba(255,255,255,0.04);
      backdrop-filter: blur(6px);
      border: 1px solid rgba(255,255,255,0.06);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: rgba(255,255,255,0.45);
      transition: all 0.2s ease;
    }
    .en-stats-hdr-close:hover { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.92); border-color: rgba(255,255,255,0.14); }
    .en-stats-hdr-close svg { width: 14px; height: 14px; }

    /* Partnership Badge */
    .en-stats-partner {
      display: inline-flex;
      align-items: center;
      margin-left: 6px;
      color: #ffd700;
    }
    .en-stats-partner svg { width: 14px; height: 14px; fill: #ffd700; stroke: #ffd700; filter: drop-shadow(0 0 4px rgba(255,215,0,0.4)); }

    /* Body */
    .en-stats-body {
      max-height: calc(85vh - 56px);
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: rgba(255,255,255,0.08) transparent;
    }
    .en-stats-body::-webkit-scrollbar { width: 3px; }
    .en-stats-body::-webkit-scrollbar-track { background: transparent; }
    .en-stats-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 9999px; }

    .en-stats-content { padding: 14px 18px; display: flex; flex-direction: column; gap: 10px; }

    /* Loading / Error */
    .en-stats-loading, .en-stats-error {
      padding: 48px 18px;
      text-align: center;
      font-size: 12px;
    }
    .en-stats-loading { color: rgba(255,255,255,0.38); }
    .en-stats-error { color: #ff6b4a; }

    /* Sponsored */
    .en-stats-ad {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 10px;
      padding: 6px 10px;
      border-radius: 10px;
      font-weight: 600;
      background: rgba(255,149,0,0.1);
      color: #ff9500;
      align-self: flex-start;
      border: 1px solid rgba(255,149,0,0.15);
    }
    .en-stats-ad svg { width: 12px; height: 12px; }

    /* Author */
    .en-stats-author {
      position: relative;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      background: rgba(255,255,255,0.02);
      backdrop-filter: blur(6px);
      border-radius: 16px;
      border: 1px solid rgba(255,255,255,0.06);
      overflow: hidden;
      cursor: pointer;
      text-decoration: none !important;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      color: inherit;
    }
    .en-stats-author::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent 5%, rgba(255,255,255,0.08) 30%, rgba(255,255,255,0.04) 70%, transparent 95%); }
    .en-stats-author:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.12); }
    .en-stats-author-bg {
      position: absolute;
      inset: 0;
      background-size: cover;
      background-position: center;
      filter: blur(20px) brightness(0.2);
      transform: scale(1.3);
      opacity: 0.5;
    }
    .en-stats-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      object-fit: cover;
      border: 2px solid rgba(255,255,255,0.15);
      position: relative;
      z-index: 1;
      transition: border-color 0.2s ease;
    }
    .en-stats-author:hover .en-stats-avatar { border-color: rgba(255,255,255,0.3); }
    .en-stats-author-info { flex: 1; position: relative; z-index: 1; min-width: 0; }
    .en-stats-author-name {
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: rgba(255,255,255,0.92);
    }
    .en-stats-author-id {
      font-size: 10px;
      color: rgba(255,255,255,0.38);
      margin-top: 2px;
      font-family: 'IBM Plex Mono', 'SF Mono', Consolas, monospace;
      font-weight: 400;
    }

    /* Description */
    .en-stats-desc-box {
      position: relative;
      background: rgba(255,255,255,0.02);
      backdrop-filter: blur(6px);
      border-radius: 16px;
      border: 1px solid rgba(255,255,255,0.06);
      overflow: hidden;
    }
    .en-stats-desc-box::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent 5%, rgba(255,255,255,0.08) 30%, rgba(255,255,255,0.04) 70%, transparent 95%); }
    .en-stats-desc-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 14px;
      font-size: 10px;
      color: rgba(255,255,255,0.45);
      border-bottom: 1px solid rgba(255,255,255,0.04);
      font-family: 'IBM Plex Mono', monospace;
      font-weight: 500;
    }
    .en-stats-desc-meta span {
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .en-stats-desc-meta svg { width: 11px; height: 11px; opacity: 0.6; }
    .en-stats-desc-text {
      font-size: 11px;
      color: rgba(255,255,255,0.72);
      line-height: 1.65;
      padding: 10px 14px;
      word-wrap: break-word;
    }
    .en-stats-desc-text:empty { display: none; }

    /* Tags & Mentions */
    .en-stats-tag {
      display: inline;
      background: rgba(254, 44, 85, 0.12);
      color: #fe2c55;
      padding: 1px 4px;
      margin: 0;
      border-radius: 4px;
      cursor: pointer;
      transition: background 0.15s;
      font-weight: 600;
      font-size: 11px;
      font-family: inherit;
    }
    .en-stats-tag:hover { background: rgba(254, 44, 85, 0.22); }
    .en-stats-tag { position: relative; }
    .en-stats-tag.copied::after {
      content: '';
      position: absolute;
      inset: 0;
      background: rgba(0,0,0,0.7) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.5'%3E%3Cpolyline points='20 6 9 17 4 12'/%3E%3C/svg%3E") center/10px no-repeat;
      border-radius: 6px;
    }
    .en-stats-mention {
      display: inline;
      background: rgba(37, 212, 255, 0.12);
      color: #25d4ff;
      padding: 1px 4px;
      margin: 0;
      border-radius: 4px;
      text-decoration: none !important;
      font-weight: 600;
      font-size: 11px;
      font-family: inherit;
      transition: background 0.15s;
    }
    .en-stats-mention:hover { background: rgba(37, 212, 255, 0.22); }

    /* Stats Grid */
    .en-stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
    }
    .en-stats-stat {
      position: relative;
      background: rgba(255,255,255,0.02);
      backdrop-filter: blur(6px);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 14px;
      padding: 10px 6px;
      text-align: center;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      overflow: hidden;
    }
    .en-stats-stat::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent 10%, rgba(255,255,255,0.06) 40%, rgba(255,255,255,0.03) 60%, transparent 90%); }
    .en-stats-stat:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.12); }
    .en-stats-stat svg { width: 14px; height: 14px; color: rgba(255,255,255,0.45); margin-bottom: 4px; }
    .en-stats-stat-val { font-size: 14px; font-weight: 700; color: rgba(255,255,255,0.92); font-family: 'Space Grotesk', 'Manrope', sans-serif; letter-spacing: -0.028em; }

    /* Enhanced stats for PRO users */
    .en-stats-grid.enhanced .en-stats-stat { background: rgba(255,215,0,0.04); border: 1px solid rgba(255,215,0,0.12); }
    .en-stats-grid.enhanced .en-stats-stat:hover { background: rgba(255,215,0,0.08); border-color: rgba(255,215,0,0.2); }
    .en-stats-grid.enhanced .en-stats-stat svg { color: #ffd700; }
    .en-stats-grid.enhanced .en-stats-stat-val { font-size: 12px; color: #ffd700; }

    .en-stats-stat-lbl {
      font-size: 8px;
      color: rgba(255,255,255,0.38);
      text-transform: uppercase;
      margin-top: 3px;
      letter-spacing: 0.06em;
      font-family: 'IBM Plex Mono', monospace;
      font-weight: 500;
    }

    /* Section */
    .en-stats-section {
      position: relative;
      background: rgba(255,255,255,0.02);
      backdrop-filter: blur(6px);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 16px;
      padding: 14px;
      overflow: hidden;
    }
    .en-stats-section::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent 5%, rgba(255,255,255,0.08) 30%, rgba(255,255,255,0.04) 70%, transparent 95%); }
    .en-stats-section-title {
      font-size: 10px;
      font-weight: 600;
      color: rgba(255,255,255,0.45);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 6px;
      font-family: 'IBM Plex Mono', monospace;
    }
    .en-stats-section-title svg { width: 12px; height: 12px; opacity: 0.5; }

    /* Rows */
    .en-stats-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 7px 0;
      font-size: 12px;
    }
    .en-stats-row + .en-stats-row { border-top: 1px solid rgba(255,255,255,0.04); }
    .en-stats-row-lbl {
      color: rgba(255,255,255,0.55);
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 500;
    }
    .en-stats-row-lbl svg { width: 13px; height: 13px; opacity: 0.5; }
    .en-stats-row-val { color: rgba(255,255,255,0.92); font-weight: 600; font-family: 'IBM Plex Mono', monospace; }

    /* Button */
    .en-stats-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      padding: 10px;
      border-radius: 14px;
      border: 1px solid rgba(255,255,255,0.06);
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      font-family: 'Manrope', sans-serif;
      background: rgba(255,255,255,0.04);
      backdrop-filter: blur(6px);
      color: rgba(255,255,255,0.72);
      margin-top: 10px;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      text-decoration: none !important;
    }
    .en-stats-btn:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.92); border-color: rgba(255,255,255,0.14); }
    .en-stats-btn:active { transform: scale(0.98); }
    .en-stats-btn svg { width: 14px; height: 14px; }
    .en-stats-btn-original.enabled {
      background: linear-gradient(135deg, rgba(254,44,85,0.12), rgba(254,44,85,0.06));
      border-color: rgba(254,44,85,0.2);
      color: #fe2c55;
    }
    .en-stats-btn-original.enabled:hover { background: linear-gradient(135deg, rgba(254,44,85,0.2), rgba(254,44,85,0.1)); border-color: rgba(254,44,85,0.3); }
    .en-stats-btn-original.disabled { opacity: 0.5; }
    .en-stats-btn-original.disabled:hover { opacity: 0.7; }
    .en-stats-btn-original.loading { pointer-events: none; opacity: 0.7; }
    @keyframes enSpin { to { transform: rotate(360deg); } }
    .en-stats-btn-original .en-spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(254,44,85,0.3); border-top-color: #fe2c55; border-radius: 50%; animation: enSpin 0.6s linear infinite; }

    /* Music */
    .en-stats-music {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
    }
    .en-stats-music-cover-wrap {
      position: relative;
      width: 44px;
      height: 44px;
      flex-shrink: 0;
    }
    .en-stats-music-cover {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      object-fit: cover;
      border: 1px solid rgba(255,255,255,0.06);
    }
    .en-stats-music-play {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,0.5);
      border-radius: 12px;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.2s;
    }
    .en-stats-music-cover-wrap:hover .en-stats-music-play,
    .en-stats-music-play.playing { opacity: 1; }
    .en-stats-music-play svg { width: 16px; height: 16px; color: #fff; }
    .en-stats-music-play.playing { background: rgba(255,255,255,0.15); }
    .en-stats-music-info { flex: 1; min-width: 0; }
    .en-stats-music-title {
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: rgba(255,255,255,0.92);
    }
    .en-stats-music-author {
      font-size: 10px;
      color: rgba(255,255,255,0.38);
      margin-top: 3px;
      font-family: 'IBM Plex Mono', monospace;
      font-weight: 500;
    }
    .en-stats-music-badge {
      font-size: 9px;
      padding: 4px 8px;
      background: rgba(255,255,255,0.04);
      color: rgba(255,255,255,0.55);
      border-radius: 8px;
      font-weight: 600;
      border: 1px solid rgba(255,255,255,0.06);
      font-family: 'IBM Plex Mono', monospace;
    }

    /* ID */
    .en-stats-id {
      font-family: 'IBM Plex Mono', 'SF Mono', Consolas, monospace;
      font-size: 9px;
      font-weight: 500;
      color: rgba(255,255,255,0.15);
      text-align: center;
      margin-top: 4px;
    }

    /* Footer */
    .en-stats-footer {
      text-align: center;
      padding: 10px 18px 14px;
      margin-top: 6px;
      border-top: 1px solid rgba(255,255,255,0.06);
      font-size: 9px;
      font-weight: 500;
      color: rgba(255,255,255,0.15);
      font-family: 'IBM Plex Mono', monospace;
    }

    /* ===== LIGHT THEME ===== */
    .en-stats-panel.light {
      background: rgba(248, 249, 250, 0.92);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border-color: rgba(0,0,0,0.08);
      color: #212529;
      box-shadow: 0 8px 32px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.8);
    }
    .light .en-stats-hdr { border-color: rgba(0,0,0,0.06); }
    .light .en-stats-hdr-title { color: #212529; }
    .light .en-stats-hdr-title svg { opacity: 0.45; }
    .light .en-stats-hdr-close { background: rgba(0,0,0,0.03); border-color: rgba(0,0,0,0.06); color: #6c757d; }
    .light .en-stats-hdr-close:hover { background: rgba(0,0,0,0.06); color: #212529; border-color: rgba(0,0,0,0.1); }
    .light .en-stats-body::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); }
    .light .en-stats-loading { color: #6c757d; }
    .light .en-stats-error { color: #dc3545; }

    .light .en-stats-author { background: rgba(255,255,255,0.8); border-color: rgba(0,0,0,0.06); }
    .light .en-stats-author::before { background: linear-gradient(90deg, transparent 5%, rgba(0,0,0,0.04) 30%, rgba(0,0,0,0.02) 70%, transparent 95%); }
    .light .en-stats-author:hover { background: rgba(255,255,255,0.95); border-color: rgba(0,0,0,0.1); }
    .light .en-stats-avatar { border-color: rgba(0,0,0,0.1); }
    .light .en-stats-author:hover .en-stats-avatar { border-color: rgba(0,0,0,0.2); }
    .light .en-stats-author-name { color: #212529; }
    .light .en-stats-author-id { color: #6c757d; }

    .light .en-stats-desc-box { background: rgba(255,255,255,0.8); border-color: rgba(0,0,0,0.06); }
    .light .en-stats-desc-box::before { background: linear-gradient(90deg, transparent 5%, rgba(0,0,0,0.04) 30%, rgba(0,0,0,0.02) 70%, transparent 95%); }
    .light .en-stats-desc-meta { color: #495057; border-color: rgba(0,0,0,0.04); }
    .light .en-stats-desc-text { color: #212529; }
    .light .en-stats-tag { background: rgba(254, 44, 85, 0.1); }
    .light .en-stats-mention { background: rgba(0, 149, 246, 0.1); color: #0095f6; }

    .light .en-stats-stat { background: rgba(255,255,255,0.8); border-color: rgba(0,0,0,0.06); }
    .light .en-stats-stat::before { background: linear-gradient(90deg, transparent 10%, rgba(0,0,0,0.03) 40%, rgba(0,0,0,0.015) 60%, transparent 90%); }
    .light .en-stats-stat:hover { background: rgba(255,255,255,0.95); border-color: rgba(0,0,0,0.1); }
    .light .en-stats-stat svg { color: #6c757d; }
    .light .en-stats-stat-val { color: #212529; }
    .light .en-stats-stat-lbl { color: #6c757d; }

    /* Light theme partnership */
    .light .en-stats-partner { color: #f59f00; }
    .light .en-stats-partner svg { fill: #f59f00; stroke: #f59f00; filter: drop-shadow(0 0 4px rgba(245,159,0,0.3)); }
    .light .en-stats-grid.enhanced .en-stats-stat { background: rgba(255,193,7,0.08); border-color: rgba(255,152,0,0.2); }
    .light .en-stats-grid.enhanced .en-stats-stat:hover { background: rgba(255,193,7,0.12); }
    .light .en-stats-grid.enhanced .en-stats-stat svg { color: #ff9800; }
    .light .en-stats-grid.enhanced .en-stats-stat-val { color: #e65100; }

    .light .en-stats-section { background: rgba(255,255,255,0.8); border-color: rgba(0,0,0,0.06); }
    .light .en-stats-section::before { background: linear-gradient(90deg, transparent 5%, rgba(0,0,0,0.04) 30%, rgba(0,0,0,0.02) 70%, transparent 95%); }
    .light .en-stats-section-title { color: #495057; }
    .light .en-stats-row + .en-stats-row { border-color: rgba(0,0,0,0.04); }
    .light .en-stats-row-lbl { color: #495057; }
    .light .en-stats-row-val { color: #212529; }
    .light .en-stats-btn { background: rgba(0,0,0,0.03); border-color: rgba(0,0,0,0.06); color: #212529; }
    .light .en-stats-btn:hover { background: rgba(0,0,0,0.06); border-color: rgba(0,0,0,0.1); }
    .light .en-stats-btn-original.enabled { background: linear-gradient(135deg, rgba(254,44,85,0.08), rgba(254,44,85,0.04)); border-color: rgba(254,44,85,0.15); color: #fe2c55; }
    .light .en-stats-btn-original.enabled:hover { background: linear-gradient(135deg, rgba(254,44,85,0.14), rgba(254,44,85,0.08)); border-color: rgba(254,44,85,0.25); }
    .light .en-stats-btn-original .en-spinner { border-color: rgba(254,44,85,0.2); border-top-color: #fe2c55; }

    .light .en-stats-music-cover { border-color: rgba(0,0,0,0.06); }
    .light .en-stats-music-title { color: #212529; }
    .light .en-stats-music-author { color: #6c757d; }
    .light .en-stats-music-badge { background: rgba(0,0,0,0.03); color: #495057; border-color: rgba(0,0,0,0.06); }

    .light .en-stats-id { color: #adb5bd; }
    .light .en-stats-footer { border-color: rgba(0,0,0,0.06); color: #adb5bd; }
  `,Y=e=>e>=1e6?(e/1e6).toFixed(1)+"M":e>=1e3?(e/1e3).toFixed(1)+"K":String(e),X=e=>e.toLocaleString(r.language==="ru"?"ru-RU":"en-US"),z=e=>`${Math.floor(e/60)}:${String(e%60).padStart(2,"0")}`,F=e=>e>=1048576?(e/1048576).toFixed(2)+" MB":e>=1024?(e/1024).toFixed(1)+" KB":e+" B",V=e=>new Date(e*1e3).toLocaleDateString(r.language==="ru"?"ru-RU":"en-US",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}),q=e=>e?e.replace(/@([\w.]+)/g,'<a class="en-stats-mention" href="https://www.tiktok.com/@$1" target="_blank">@$1</a>').replace(/#([\w\u0400-\u04FF]+)/g,'<span class="en-stats-tag" data-tag="#$1">#$1</span>'):"",O=(e,d,o=15e3)=>new Promise((u,y)=>{const $=Math.random().toString(36).slice(2),K=N=>{N.source!==window||N.data?.type!=="__EN_FETCH_RESPONSE__"||N.data.id!==$||(window.removeEventListener("message",K),N.data.success?u(N.data.data):y(new Error(N.data.error)))};window.addEventListener("message",K),window.postMessage({type:"__EN_FETCH_REQUEST__",id:$,endpoint:e,params:d},"*"),setTimeout(()=>{window.removeEventListener("message",K),y(new Error("Timeout"))},o)}),U=async(e,d=2)=>{const o={url:e};r.features?.enhancedStats&&(o.enhanced="true");try{const u=await O("/api/video",o);if(u.code!==0)throw new Error(u.msg);return u.data}catch(u){if(d>0&&u.message?.includes("RATE_LIMIT"))return await new Promise(y=>setTimeout(y,1100)),U(e,d-1);throw u}},R=(e,d)=>{window.postMessage({type:"__EN_DOWNLOAD_REQUEST__",id:Math.random().toString(36).slice(2),url:e,filename:d},"*")},W=()=>{const e=r.theme==="light",d=document.getElementById("en-stats-panel"),o=document.getElementById("en-stats-fab");d&&d.classList.toggle("light",e),o&&o.classList.toggle("light",e)},n=()=>{const e=document.getElementById("en-stats-panel");e&&s&&(e.innerHTML=g(s),W(),l(e))},l=e=>{document.getElementById("en-stats-close")?.addEventListener("click",()=>e.classList.add("hidden")),e.querySelector(".en-stats-btn[data-video]")?.addEventListener("click",d=>{const o=d.currentTarget;R(o.dataset.url,o.dataset.name)}),e.querySelector(".en-stats-btn[data-music]")?.addEventListener("click",d=>{const o=d.currentTarget;R(o.dataset.url,o.dataset.name)}),e.querySelector(".en-stats-btn[data-original]")?.addEventListener("click",async d=>{const o=d.currentTarget;if(!o.classList.contains("loading")){if(!r.features?.originalDownload){window.open("https://editingnews.com/retiktok","_blank");return}o.classList.add("loading"),o.innerHTML=`<span class="en-spinner"></span> ${k("downloadingOriginal")}`;try{const u=await O("/api/video/original",{url:o.dataset.videoUrl},6e4);u.code===0&&u.data?.url&&R(u.data.url,`${o.dataset.author}_${o.dataset.videoId}_original.mp4`)}catch{}finally{o.classList.remove("loading"),o.innerHTML=`${E.sparkle} ${k("downloadOriginal")}`}}}),e.querySelector(".en-stats-music-play")?.addEventListener("click",d=>{const o=d.currentTarget,u=o.dataset.url;h&&!h.paused?(h.pause(),h=null,o.classList.remove("playing"),o.innerHTML=E.play):(h&&h.pause(),h=new Audio(u),h.play(),o.classList.add("playing"),o.innerHTML=E.pause,h.onended=()=>{o.classList.remove("playing"),o.innerHTML=E.play})}),e.querySelectorAll(".en-stats-tag").forEach(d=>{d.addEventListener("click",o=>{o.preventDefault();const u=o.currentTarget;navigator.clipboard.writeText(u.dataset.tag).then(()=>{u.classList.add("copied"),setTimeout(()=>u.classList.remove("copied"),800)})})})},g=e=>{const d=e._enhanced===!0,o=$=>typeof $=="number"?d?X($):Y($):String($),u=[{icon:E.eye,val:o(e.play_count),lbl:k("views")},{icon:E.heart,val:o(e.digg_count),lbl:k("likes")},{icon:E.msg,val:o(e.comment_count),lbl:k("comments")},{icon:E.share,val:o(e.share_count),lbl:k("shares")},{icon:E.bookmark,val:o(e.collect_count),lbl:k("saves")},{icon:E.download,val:o(e.download_count),lbl:k("downloads")}],y=e.music||e.music_info;return`
      <div class="en-stats-hdr">
        <span class="en-stats-hdr-title">${E.stats} ${k("title")}${d?'<span class="en-stats-partner"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"/><path d="M5 21h14"/></svg></span>':""}</span>
        <button class="en-stats-hdr-close" id="en-stats-close">${E.x}</button>
      </div>
      <div class="en-stats-body">
        <div class="en-stats-content">
          ${e.is_ad?`<span class="en-stats-ad">${E.ad} ${k("sponsored")}</span>`:""}

          <a class="en-stats-author" href="https://www.tiktok.com/@${e.author.unique_id}" target="_blank">
            <div class="en-stats-author-bg" style="background-image:url('${e.cover}')"></div>
            <img class="en-stats-avatar" src="${e.author.avatar}" alt="">
            <div class="en-stats-author-info">
              <div class="en-stats-author-name">${e.author.nickname}</div>
              <div class="en-stats-author-id">@${e.author.unique_id}</div>
            </div>
          </a>

          <div class="en-stats-desc-box">
            <div class="en-stats-desc-meta">
              <span>${E.calendar} ${V(e.create_time)}</span>
              <span>${E.globe} ${ee(e.region)}</span>
            </div>
            ${e.title?`<div class="en-stats-desc-text">${q(e.title)}</div>`:""}
          </div>

          <div class="en-stats-grid${d?" enhanced":""}">
            ${u.map($=>`<div class="en-stats-stat">${$.icon}<div class="en-stats-stat-val">${$.val}</div><div class="en-stats-stat-lbl">${$.lbl}</div></div>`).join("")}
          </div>

          <div class="en-stats-section">
            <div class="en-stats-section-title">${E.video} ${k("details")}</div>
            <div class="en-stats-row">
              <span class="en-stats-row-lbl">${E.clock} ${k("duration")}</span>
              <span class="en-stats-row-val">${z(e.duration)}</span>
            </div>
            <div class="en-stats-row">
              <span class="en-stats-row-lbl">${E.hdd} ${k("size")}</span>
              <span class="en-stats-row-val">${F(e.size)}</span>
            </div>
            <button class="en-stats-btn" data-video data-url="${e.play}" data-name="${e.author.unique_id}_${e.id}.mp4">
              ${E.download} ${k("video")}
            </button>
            <button class="en-stats-btn en-stats-btn-original ${r.features?.originalDownload?"enabled":"disabled"}" data-original data-video-url="${m||""}" data-author="${e.author.unique_id}" data-video-id="${e.id}">
              ${E.sparkle} ${k("downloadOriginal")}
            </button>
          </div>

          ${y?`
          <div class="en-stats-section">
            <div class="en-stats-section-title">${E.music} ${k("sound")}</div>
            <div class="en-stats-music">
              <div class="en-stats-music-cover-wrap">
                <img class="en-stats-music-cover" src="${y.cover}" alt="">
                ${y.play?`<div class="en-stats-music-play" data-url="${y.play}">${E.play}</div>`:""}
              </div>
              <div class="en-stats-music-info">
                <div class="en-stats-music-title">${y.title}</div>
                <div class="en-stats-music-author">${y.author}</div>
              </div>
              ${y.original?`<span class="en-stats-music-badge">${k("original")}</span>`:""}
            </div>
            ${y.play?`
            <button class="en-stats-btn" data-music data-url="${y.play}" data-name="${(y.title||"music").replace(/[^\w\s-]/g,"")}.mp3">
              ${E.download} ${k("sound")}
            </button>
            `:""}
          </div>
          `:""}

          <div class="en-stats-id"># ${e.id}</div>
        </div>
        <div class="en-stats-footer">© 2026 TikTok Enhancer. All rights reserved.</div>
      </div>
    `},p=()=>{if(!le){if(!document.getElementById("en-gfonts")){const d=document.createElement("link");d.id="en-gfonts",d.rel="stylesheet",d.href=["https://fonts.googleap","is.com/css2?family=IBM+Plex+Mono:wght@400;500;600","&family=Manrope:wght@400;500;600;700;800","&family=Space+Grotesk:wght@500;700&display=swap"].join(""),document.head.appendChild(d)}const e=document.createElement("style");e.id="en-stats-style",e.textContent=te,document.head.appendChild(e),le=!0}},x=()=>{let e=document.getElementById("en-stats-panel");return e||(e=document.createElement("div"),e.id="en-stats-panel",e.className=`en-stats-panel hidden${r.theme==="light"?" light":""}`,document.body.appendChild(e)),e},S=(e,d)=>{if(d.closest(".en-browse-buttons")){const oe=document.querySelector('[data-e2e="arrow-right"]'),ae=document.querySelector('[data-e2e="arrow-left"]'),pe=oe?.offsetWidth?oe:ae?.offsetWidth?ae:null;if(pe){const ye=pe.getBoundingClientRect();e.style.left=ye.left-340-14+"px";const se=ae?.offsetWidth?ae.getBoundingClientRect():null,ie=oe?.offsetWidth?oe.getBoundingClientRect():null,_e=se?se.top:ie.top,ke=ie?ie.bottom:se.bottom,Ee=(_e+ke)/2;e.style.top=Ee-e.offsetHeight/2+"px"}else e.style.left=window.innerWidth-340-100+"px",e.style.top="80px";e.style.right="auto",e.style.transform="none";return}const u=d.getBoundingClientRect(),y=340,$=16;window.innerWidth-u.right-$>=y?e.style.left=u.right+$+"px":e.style.left=Math.max(10,u.left-$-y)+"px",e.style.right="auto";const N=e.offsetHeight;let re=u.top+u.height/2-N/2;re=Math.max(10,Math.min(re,window.innerHeight-N-10)),e.style.top=re+"px"},w=async(e,d)=>{if(!f.videoStats)return;d&&(v=d);const o=x(),u=document.getElementById("en-author-panel");if(u&&u.classList.add("hidden"),m===e&&_&&!o.classList.contains("hidden")){o.classList.add("hidden");return}if(m!==e&&(s=null,_=!1,m=e),o.classList.remove("hidden"),W(),_&&s){v&&S(o,v);return}o.innerHTML=`<div class="en-stats-hdr"><span class="en-stats-hdr-title">${E.stats} ${k("title")}</span></div><div class="en-stats-loading">${k("loading")}</div>`,v&&S(o,v);try{const y=await U(e);if(m!==e)return;s=y,_=!0,o.innerHTML=g(y),l(o),v&&S(o,v)}catch{if(m!==e)return;o.innerHTML=`<div class="en-stats-hdr"><span class="en-stats-hdr-title">${E.stats} ${k("title")}</span></div><div class="en-stats-error">${k("error")}</div>`}},T=e=>{if(e.querySelector(".en-stats-action-btn"))return;const d=Z(e);if(!d||!D(e)||J(e))return;const u=document.createElement("div");u.className="en-stats-action-btn en-light-swipe",u.innerHTML=`<button type="button" class="en-stats-action-btn-icon">${E.stats}</button><strong class="en-stats-action-btn-label">${k("buttonLabel")}</strong>`,u.onclick=y=>{y.preventDefault();const $=D(e);$&&w($,u)},d.appendChild(u)},t=()=>{document.querySelectorAll("article[data-scroll-index]").forEach(e=>T(e))},i=e=>{const d=document.querySelector(".en-browse-buttons");if(d)return d;let o=e;for(;o.parentElement&&getComputedStyle(o.parentElement).flexDirection!=="column";)o=o.parentElement;if(!o.parentElement)return null;const u=document.createElement("div");return u.className="en-browse-buttons",u.style.cssText="display: flex; gap: 16px; align-items: center; justify-content: center; padding: 4px 0;",o.parentElement.insertBefore(u,o),u},a=()=>{const e=document.querySelector('[data-e2e="browse-like-icon"]');if(!e)return;const d=e.closest('[class*="DivFlexCenterRow"]');if(!d)return;const o=i(d);if(!o)return;if(Q()||H()){o.querySelector(".en-stats-action-btn")?.remove();return}if(o.querySelector(".en-stats-action-btn"))return;const u=document.createElement("div");u.className="en-stats-action-btn en-light-swipe",u.innerHTML=`<button type="button" class="en-stats-action-btn-icon">${E.stats}</button><strong class="en-stats-action-btn-label">${k("buttonLabel")}</strong>`,u.onclick=y=>{y.preventDefault();const $=D();$&&w($,u)},o.appendChild(u)},c=()=>{t(),a()};window.addEventListener("resize",()=>{const e=document.getElementById("en-stats-panel");e&&!e.classList.contains("hidden")&&e.classList.add("hidden")});const b=()=>{if(p(),x(),c(),!I){let e=!1;I=new MutationObserver(()=>{e||(e=!0,requestAnimationFrame(()=>{e=!1,c()}))}),I.observe(document.body,{childList:!0,subtree:!0})}};window.addEventListener("message",e=>{if(!(e.source!==window||e.data?.type!=="__EN_ACTIVE__")){if(!e.data.features?.videoStats){M();return}f.videoStats=!0,b()}});const P=()=>{document.getElementById("en-stats-panel")?.classList.add("hidden"),document.getElementById("en-author-panel")?.classList.add("hidden"),h&&(h.pause(),h=null),s=null,_=!1,m=null,v=null},A=e=>{const d=e.target;if(d?.closest?.("#en-stats-panel")||d?.closest?.("#en-author-panel"))return;const o=document.getElementById("en-stats-panel"),u=document.getElementById("en-author-panel");(o&&!o.classList.contains("hidden")||u&&!u.classList.contains("hidden"))&&P()};document.addEventListener("scroll",A,{passive:!0,capture:!0}),document.addEventListener("wheel",A,{passive:!0,capture:!0}),document.addEventListener("touchmove",A,{passive:!0,capture:!0}),document.addEventListener("click",e=>{const d=document.getElementById("en-stats-panel");if(!d||d.classList.contains("hidden"))return;const o=e.target;d.contains(o)||o.closest(".en-stats-action-btn")||(d.classList.add("hidden"),h&&(h.pause(),h=null),s=null,_=!1,m=null,v=null)}),document.addEventListener("click",e=>{const d=document.getElementById("en-author-panel");if(!d||d.classList.contains("hidden"))return;const o=e.target;d.contains(o)||o.closest(".en-author-action-btn")||d.classList.add("hidden")});let ne=location.pathname;setInterval(()=>{if(!f.videoStats)return;const e=location.pathname;e!==ne&&(ne=e,P())},50)})();let de=!1;(function(){let r={language:"en",theme:"dark",features:{}},s=null,_=!1,h=!1,B=!1,L=null,m=null,v=null;const I=t=>{const i=t.querySelector('a[href*="/@"]');return i&&i.getAttribute("href")?.match(/\/@([^\/?]+)/)?.[1]||null},D=t=>t.querySelector('[class*="ActionBarContainer"]'),Z=t=>!!t.querySelector('[data-e2e="ad-tag"], [data-e2e="ad-label"]'),J=()=>!!document.querySelector('[data-e2e="ad-tag"], [data-e2e="ad-label"]');document.addEventListener("visibilitychange",()=>{!document.hidden&&B&&_&&(B=!1,Q())});const Q=async()=>{const t=document.getElementById("en-author-panel");if(!(!t||t.classList.contains("hidden")||h||!L)){h=!0,t.innerHTML=`<div class="en-author-hdr"><span class="en-author-hdr-title">${C.user} ${M("title")}</span></div><div class="en-author-loading">${M("loading")}</div>`;try{const i=await Y(L);s=i,_=!0,t.innerHTML=V(i),F(t)}catch{t.innerHTML=`<div class="en-author-hdr"><span class="en-author-hdr-title">${C.user} ${M("title")}</span></div><div class="en-author-error">${M("error")}</div>`}h=!1}},H=()=>{document.getElementById("en-author-panel")?.remove(),document.getElementById("en-author-style")?.remove(),document.querySelectorAll(".en-author-action-btn").forEach(t=>t.remove()),document.getElementById("en-author-fab")?.remove(),v&&(v.disconnect(),v=null),s=null,_=!1,L=null,m=null,f.authorStats=!1,de=!1};window.addEventListener("message",t=>{if(t.source!==window||t.data?.type!=="__EN_SETTINGS__"||!f.authorized)return;const i=r.language,a=r.features?.enhancedStats,c=r.features?.authorStats;if(r={...r,...t.data.settings},c&&!r.features?.authorStats){H();return}if(!c&&r.features?.authorStats&&f.authorStats){w();return}X(),a!==r.features?.enhancedStats&&_?document.hidden?B=!0:Q():i!==r.language&&(document.querySelectorAll(".en-author-action-btn-label").forEach(b=>{b.textContent=M("buttonLabel")}),s&&_&&z())}),window.postMessage({type:"__EN_GET_SETTINGS__"},"*");const j={en:{title:"Author Stats",buttonLabel:"Author",loading:"Loading...",error:"Failed to load stats",followers:"Followers",following:"Following",likes:"Likes",videos:"Videos",liked:"Liked",info:"Account Info",created:"Created",verified:"Verified",private:"Private",public:"Public",noBio:"No bio yet",account:"Account",yes:"Yes",no:"No"},ru:{title:"Статистика",buttonLabel:"Автор",loading:"Загрузка...",error:"Ошибка загрузки",followers:"Подписчики",following:"Подписки",likes:"Лайки",videos:"Видео",liked:"Оценено",info:"Информация",created:"Создан",verified:"Верифицирован",private:"Приватный",public:"Публичный",noBio:"Нет описания",account:"Аккаунт",yes:"Да",no:"Нет"}},M=t=>j[r.language]?.[t]||j.en[t]||t,C={user:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',heart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',users:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',userPlus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>',video:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/></svg>',calendar:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>',shield:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>',check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>',lock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',globe:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>'},k=`
    @keyframes enFadeIn { from { opacity: 0; transform: scale(0.97) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
    @keyframes enLightSwipe {
      0% { background-position: 200% center; }
      100% { background-position: -200% center; }
    }

    /* Inline action button in TikTok action bar */
    .en-author-action-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      padding: 0;
      margin-top: 4px;
    }
    .en-author-action-btn:active { transform: scale(0.9); }
    .en-author-action-btn-icon {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.08);
      display: flex;
      align-items: center;
      justify-content: center;
      color: rgba(255, 255, 255, 0.9);
      transition: all 0.2s ease;
      border: none;
      cursor: pointer;
      padding: 0;
      position: relative;
      overflow: hidden;
    }
    .en-author-action-btn-icon:hover { background: rgba(255, 255, 255, 0.18); color: #fff; }
    .en-author-action-btn-icon svg { width: 24px; height: 24px; position: relative; z-index: 1; }
    .en-author-action-btn.en-light-swipe .en-author-action-btn-icon::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      background: linear-gradient(105deg, transparent 20%, rgba(255,255,255,0.45) 45%, rgba(255,255,255,0.6) 50%, rgba(255,255,255,0.45) 55%, transparent 80%);
      background-size: 250% 100%;
      animation: enLightSwipe 1.8s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    }
    .en-author-action-btn-label {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.75);
      margin-top: 2px;
      font-weight: 700;
      line-height: 17px;
      font-family: TikTokFont, Arial, Tahoma, PingFangSC, sans-serif;
    }

    /* Panel */
    .en-author-panel {
      position: fixed;
      width: 340px;
      max-height: 85vh;
      background: rgba(10, 10, 14, 0.88);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border-radius: 20px;
      border: 1px solid rgba(255,255,255,0.08);
      z-index: 9998;
      font-family: 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif;
      font-weight: 500;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      color: #fff;
      overflow: hidden;
      animation: enFadeIn 0.2s ease;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04);
    }
    .en-author-panel.hidden { display: none; }

    /* Header */
    .en-author-hdr {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 18px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .en-author-hdr-title {
      font-size: 14px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
      color: rgba(255,255,255,0.92);
      font-family: 'Space Grotesk', 'Manrope', sans-serif;
      letter-spacing: -0.028em;
    }
    .en-author-hdr-title svg { width: 16px; height: 16px; opacity: 0.55; }
    .en-author-hdr-close {
      width: 28px;
      height: 28px;
      border-radius: 10px;
      background: rgba(255,255,255,0.04);
      backdrop-filter: blur(6px);
      border: 1px solid rgba(255,255,255,0.06);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: rgba(255,255,255,0.45);
      transition: all 0.2s ease;
    }
    .en-author-hdr-close:hover { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.92); border-color: rgba(255,255,255,0.14); }
    .en-author-hdr-close svg { width: 14px; height: 14px; }

    /* Partnership Badge */
    .en-author-partner {
      display: inline-flex;
      align-items: center;
      margin-left: 6px;
      color: #ffd700;
    }
    .en-author-partner svg { width: 14px; height: 14px; fill: #ffd700; stroke: #ffd700; filter: drop-shadow(0 0 4px rgba(255,215,0,0.4)); }

    /* Body */
    .en-author-body {
      max-height: calc(85vh - 56px);
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: rgba(255,255,255,0.08) transparent;
    }
    .en-author-body::-webkit-scrollbar { width: 3px; }
    .en-author-body::-webkit-scrollbar-track { background: transparent; }
    .en-author-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 9999px; }

    .en-author-content { padding: 14px 18px; display: flex; flex-direction: column; gap: 10px; }

    /* Loading / Error */
    .en-author-loading, .en-author-error {
      padding: 48px 18px;
      text-align: center;
      font-size: 12px;
    }
    .en-author-loading { color: rgba(255,255,255,0.38); }
    .en-author-error { color: #ff6b4a; }

    /* Profile Card */
    .en-author-profile {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 18px 16px;
      background: rgba(255,255,255,0.02);
      backdrop-filter: blur(6px);
      border-radius: 16px;
      border: 1px solid rgba(255,255,255,0.06);
      text-align: center;
      overflow: hidden;
    }
    .en-author-profile::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent 5%, rgba(255,255,255,0.08) 30%, rgba(255,255,255,0.04) 70%, transparent 95%); }
    .en-author-avatar {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      object-fit: cover;
      border: 3px solid rgba(255,255,255,0.12);
      margin-bottom: 12px;
      transition: border-color 0.2s ease;
    }
    .en-author-name {
      font-size: 17px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 6px;
      color: rgba(255,255,255,0.92);
      font-family: 'Space Grotesk', 'Manrope', sans-serif;
      letter-spacing: -0.028em;
    }
    .en-author-verified {
      width: 16px;
      height: 16px;
      color: #20d5ec;
    }
    .en-author-username {
      font-size: 11px;
      color: rgba(255,255,255,0.38);
      margin-top: 4px;
      font-family: 'IBM Plex Mono', 'SF Mono', Consolas, monospace;
      font-weight: 500;
    }
    .en-author-bio {
      font-size: 11px;
      color: rgba(255,255,255,0.55);
      margin-top: 10px;
      line-height: 1.5;
      max-width: 100%;
      word-wrap: break-word;
    }
    .en-author-bio.empty {
      font-style: italic;
      color: rgba(255,255,255,0.25);
    }

    /* Stats Grid */
    .en-author-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 6px;
    }
    .en-author-stat {
      position: relative;
      background: rgba(255,255,255,0.02);
      backdrop-filter: blur(6px);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 14px;
      padding: 10px 4px;
      text-align: center;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      overflow: hidden;
    }
    .en-author-stat::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent 10%, rgba(255,255,255,0.06) 40%, rgba(255,255,255,0.03) 60%, transparent 90%); }
    .en-author-stat:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.12); }
    .en-author-stat svg { width: 14px; height: 14px; color: rgba(255,255,255,0.45); margin-bottom: 4px; }
    .en-author-stat-val { font-size: 14px; font-weight: 700; color: rgba(255,255,255,0.92); font-family: 'Space Grotesk', 'Manrope', sans-serif; letter-spacing: -0.028em; }

    /* Enhanced stats for PRO users */
    .en-author-grid.enhanced .en-author-stat { background: rgba(255,215,0,0.04); border: 1px solid rgba(255,215,0,0.12); }
    .en-author-grid.enhanced .en-author-stat:hover { background: rgba(255,215,0,0.08); border-color: rgba(255,215,0,0.2); }
    .en-author-grid.enhanced .en-author-stat svg { color: #ffd700; }
    .en-author-grid.enhanced .en-author-stat-val { font-size: 12px; color: #ffd700; }

    .en-author-stat-lbl {
      font-size: 8px;
      color: rgba(255,255,255,0.38);
      text-transform: uppercase;
      margin-top: 3px;
      letter-spacing: 0.06em;
      font-family: 'IBM Plex Mono', monospace;
      font-weight: 500;
    }

    /* Section */
    .en-author-section {
      position: relative;
      background: rgba(255,255,255,0.02);
      backdrop-filter: blur(6px);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 16px;
      padding: 14px;
      overflow: hidden;
    }
    .en-author-section::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent 5%, rgba(255,255,255,0.08) 30%, rgba(255,255,255,0.04) 70%, transparent 95%); }
    .en-author-section-title {
      font-size: 10px;
      font-weight: 600;
      color: rgba(255,255,255,0.45);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 6px;
      font-family: 'IBM Plex Mono', monospace;
    }
    .en-author-section-title svg { width: 12px; height: 12px; opacity: 0.5; }

    /* Rows */
    .en-author-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 7px 0;
      font-size: 12px;
    }
    .en-author-row + .en-author-row { border-top: 1px solid rgba(255,255,255,0.04); }
    .en-author-row-lbl {
      color: rgba(255,255,255,0.55);
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 500;
    }
    .en-author-row-lbl svg { width: 13px; height: 13px; opacity: 0.5; }
    .en-author-row-val { color: rgba(255,255,255,0.92); font-weight: 600; font-family: 'IBM Plex Mono', monospace; }
    .en-author-row-val.verified { color: #20d5ec; }
    .en-author-row-val.private { color: #ff6b4a; }
    .en-author-row-val.public { color: #4caf50; }

    /* ID */
    .en-author-id {
      font-family: 'IBM Plex Mono', 'SF Mono', Consolas, monospace;
      font-size: 9px;
      font-weight: 500;
      color: rgba(255,255,255,0.15);
      text-align: center;
      margin-top: 4px;
    }

    /* Footer */
    .en-author-footer {
      text-align: center;
      padding: 10px 18px 14px;
      margin-top: 6px;
      border-top: 1px solid rgba(255,255,255,0.06);
      font-size: 9px;
      font-weight: 500;
      color: rgba(255,255,255,0.15);
      font-family: 'IBM Plex Mono', monospace;
    }

    /* Profile page FAB */
    .en-author-fab {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9997;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      border: 1px solid rgba(255,255,255,0.1);
      background: rgba(10, 10, 14, 0.85);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      color: rgba(255,255,255,0.9);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
      transition: all 0.2s ease;
      animation: enFadeIn 0.25s ease;
      overflow: hidden;
    }
    .en-author-fab:hover { background: rgba(30,30,36,0.95); border-color: rgba(255,255,255,0.18); transform: scale(1.08); }
    .en-author-fab:active { transform: scale(0.95); }
    .en-author-fab svg { width: 22px; height: 22px; position: relative; z-index: 1; }
    .en-author-fab.en-light-swipe::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      background: linear-gradient(105deg, transparent 20%, rgba(255,255,255,0.45) 45%, rgba(255,255,255,0.6) 50%, rgba(255,255,255,0.45) 55%, transparent 80%);
      background-size: 250% 100%;
      animation: enLightSwipe 1.8s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    }

    /* ===== LIGHT THEME ===== */
    .en-author-panel.light {
      background: rgba(248, 249, 250, 0.92);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border-color: rgba(0,0,0,0.08);
      color: #212529;
      box-shadow: 0 8px 32px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.8);
    }
    .light .en-author-hdr { border-color: rgba(0,0,0,0.06); }
    .light .en-author-hdr-title { color: #212529; }
    .light .en-author-hdr-title svg { opacity: 0.45; }
    .light .en-author-hdr-close { background: rgba(0,0,0,0.03); border-color: rgba(0,0,0,0.06); color: #6c757d; }
    .light .en-author-hdr-close:hover { background: rgba(0,0,0,0.06); color: #212529; border-color: rgba(0,0,0,0.1); }
    .light .en-author-body::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); }
    .light .en-author-loading { color: #6c757d; }
    .light .en-author-error { color: #dc3545; }

    .light .en-author-profile { background: rgba(255,255,255,0.8); border-color: rgba(0,0,0,0.06); }
    .light .en-author-profile::before { background: linear-gradient(90deg, transparent 5%, rgba(0,0,0,0.04) 30%, rgba(0,0,0,0.02) 70%, transparent 95%); }
    .light .en-author-avatar { border-color: rgba(0,0,0,0.1); }
    .light .en-author-name { color: #212529; }
    .light .en-author-username { color: #495057; }
    .light .en-author-bio { color: #495057; }
    .light .en-author-bio.empty { color: #6c757d; }

    .light .en-author-stat { background: rgba(255,255,255,0.8); border-color: rgba(0,0,0,0.06); }
    .light .en-author-stat::before { background: linear-gradient(90deg, transparent 10%, rgba(0,0,0,0.03) 40%, rgba(0,0,0,0.015) 60%, transparent 90%); }
    .light .en-author-stat:hover { background: rgba(255,255,255,0.95); border-color: rgba(0,0,0,0.1); }
    .light .en-author-stat svg { color: #495057; }
    .light .en-author-stat-val { color: #212529; }
    .light .en-author-stat-lbl { color: #495057; }

    /* Light theme partnership */
    .light .en-author-partner { color: #f59f00; }
    .light .en-author-partner svg { fill: #f59f00; stroke: #f59f00; filter: drop-shadow(0 0 4px rgba(245,159,0,0.3)); }
    .light .en-author-grid.enhanced .en-author-stat { background: rgba(255,193,7,0.08); border-color: rgba(255,152,0,0.2); }
    .light .en-author-grid.enhanced .en-author-stat:hover { background: rgba(255,193,7,0.12); }
    .light .en-author-grid.enhanced .en-author-stat svg { color: #ff9800; }
    .light .en-author-grid.enhanced .en-author-stat-val { color: #e65100; }

    .light .en-author-section { background: rgba(255,255,255,0.8); border-color: rgba(0,0,0,0.06); }
    .light .en-author-section::before { background: linear-gradient(90deg, transparent 5%, rgba(0,0,0,0.04) 30%, rgba(0,0,0,0.02) 70%, transparent 95%); }
    .light .en-author-section-title { color: #495057; }
    .light .en-author-row + .en-author-row { border-color: rgba(0,0,0,0.04); }
    .light .en-author-row-lbl { color: #495057; }
    .light .en-author-row-val { color: #212529; }

    .light .en-author-id { color: #adb5bd; }
    .light .en-author-footer { border-color: rgba(0,0,0,0.06); color: #adb5bd; }
    .light .en-author-fab { background: rgba(248,249,250,0.9); border-color: rgba(0,0,0,0.1); color: #212529; box-shadow: 0 4px 20px rgba(0,0,0,0.12); }
    .light .en-author-fab:hover { background: rgba(255,255,255,0.98); border-color: rgba(0,0,0,0.16); }
  `,G=t=>t>=1e6?(t/1e6).toFixed(1)+"M":t>=1e3?(t/1e3).toFixed(1)+"K":String(t),ee=t=>t.toLocaleString(r.language==="ru"?"ru-RU":"en-US"),E=t=>{const i=r.language==="ru"?"ru-RU":"en-US",a=new Date(t*1e3);return a.toLocaleDateString(i,{day:"numeric",month:"short",year:"numeric"})+", "+a.toLocaleTimeString(i,{hour:"2-digit",minute:"2-digit"})},te=(t,i)=>new Promise((a,c)=>{const b=Math.random().toString(36).slice(2),P=A=>{A.source!==window||A.data?.type!=="__EN_FETCH_RESPONSE__"||A.data.id!==b||(window.removeEventListener("message",P),A.data.success?a(A.data.data):c(new Error(A.data.error)))};window.addEventListener("message",P),window.postMessage({type:"__EN_FETCH_REQUEST__",id:b,endpoint:t,params:i},"*"),setTimeout(()=>{window.removeEventListener("message",P),c(new Error("Timeout"))},15e3)}),Y=async(t,i=2)=>{const a={username:t};r.features?.enhancedStats&&(a.enhanced="true");try{const c=await te("/api/author",a);if(c.code!==0)throw new Error(c.msg);return c.data}catch(c){if(i>0&&c.message?.includes("RATE_LIMIT"))return await new Promise(b=>setTimeout(b,1100)),Y(t,i-1);throw c}},X=()=>{const t=r.theme==="light",i=document.getElementById("en-author-panel"),a=document.getElementById("en-author-fab");i&&i.classList.toggle("light",t),a&&a.classList.toggle("light",t)},z=()=>{const t=document.getElementById("en-author-panel");t&&s&&(t.innerHTML=V(s),X(),F(t))},F=t=>{document.getElementById("en-author-close")?.addEventListener("click",()=>t.classList.add("hidden"))},V=t=>{const i=t._enhanced===!0,a=b=>typeof b=="number"?i?ee(b):G(b):String(b),c=[{icon:C.users,val:a(t.follower_count),lbl:M("followers")},{icon:C.userPlus,val:a(t.following_count),lbl:M("following")},{icon:C.heart,val:a(t.heart_count),lbl:M("likes")},{icon:C.video,val:a(t.video_count),lbl:M("videos")}];return`
      <div class="en-author-hdr">
        <span class="en-author-hdr-title">${C.user} ${M("title")}${i?'<span class="en-author-partner"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"/><path d="M5 21h14"/></svg></span>':""}</span>
        <button class="en-author-hdr-close" id="en-author-close">${C.x}</button>
      </div>
      <div class="en-author-body">
        <div class="en-author-content">
          <div class="en-author-profile">
            <img class="en-author-avatar" src="${t.avatar}" alt="">
            <div class="en-author-name">
              ${t.nickname}
              ${t.verified?'<svg class="en-author-verified" viewBox="0 0 24 24" fill="#20d5ec" stroke="none"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4" fill="none" stroke="#fff" stroke-width="2"/></svg>':""}
            </div>
            <div class="en-author-username">@${t.unique_id}</div>
            <div class="en-author-bio${t.signature?"":" empty"}">${t.signature||M("noBio")}</div>
          </div>

          <div class="en-author-grid${i?" enhanced":""}">
            ${c.map(b=>`<div class="en-author-stat">${b.icon}<div class="en-author-stat-val">${b.val}</div><div class="en-author-stat-lbl">${b.lbl}</div></div>`).join("")}
          </div>

          <div class="en-author-section">
            <div class="en-author-section-title">${C.shield} ${M("info")}</div>
            <div class="en-author-row">
              <span class="en-author-row-lbl">${C.calendar} ${M("created")}</span>
              <span class="en-author-row-val">${E(t.create_time)}</span>
            </div>
            <div class="en-author-row">
              <span class="en-author-row-lbl">${C.check} ${M("verified")}</span>
              <span class="en-author-row-val${t.verified?" verified":""}">${t.verified?M("yes"):M("no")}</span>
            </div>
            <div class="en-author-row">
              <span class="en-author-row-lbl">${t.private?C.lock:C.globe} ${M("account")}</span>
              <span class="en-author-row-val ${t.private?"private":"public"}">${t.private?M("private"):M("public")}</span>
            </div>
          </div>

          <div class="en-author-id"># ${t.id}</div>
        </div>
        <div class="en-author-footer">© 2026 TikTok Enhancer. All rights reserved.</div>
      </div>
    `},q=()=>{if(!de){if(!document.getElementById("en-gfonts")){const i=document.createElement("link");i.id="en-gfonts",i.rel="stylesheet",i.href=["https://fonts.googleap","is.com/css2?family=IBM+Plex+Mono:wght@400;500;600","&family=Manrope:wght@400;500;600;700;800","&family=Space+Grotesk:wght@500;700&display=swap"].join(""),document.head.appendChild(i)}const t=document.createElement("style");t.id="en-author-style",t.textContent=k,document.head.appendChild(t),de=!0}},O=()=>{let t=document.getElementById("en-author-panel");return t||(t=document.createElement("div"),t.id="en-author-panel",t.className=`en-author-panel hidden${r.theme==="light"?" light":""}`,document.body.appendChild(t)),t},U=(t,i)=>{if(i.id==="en-author-fab"){const d=i.getBoundingClientRect();t.style.right="24px",t.style.left="auto";const o=t.offsetHeight;let u=d.top-o-12;u<10&&(u=10),t.style.top=u+"px";return}if(i.closest(".en-browse-buttons")){const o=document.querySelector('[data-e2e="arrow-right"]'),u=document.querySelector('[data-e2e="arrow-left"]'),y=o?.offsetWidth?o:u?.offsetWidth?u:null;if(y){const $=y.getBoundingClientRect();t.style.left=$.left-340-14+"px";const K=u?.offsetWidth?u.getBoundingClientRect():null,N=o?.offsetWidth?o.getBoundingClientRect():null,re=K?K.top:N.top,ue=N?N.bottom:K.bottom,ge=(re+ue)/2;t.style.top=ge-t.offsetHeight/2+"px"}else t.style.left=window.innerWidth-340-100+"px",t.style.top="80px";t.style.right="auto",t.style.transform="none";return}const b=i.getBoundingClientRect(),P=16;window.innerWidth-b.right-P>=340?t.style.left=b.right+P+"px":t.style.left=Math.max(10,b.left-P-340)+"px",t.style.right="auto";const ne=t.offsetHeight;let e=b.top+b.height/2-ne/2;e=Math.max(10,Math.min(e,window.innerHeight-ne-10)),t.style.top=e+"px"},R=async(t,i)=>{if(!f.authorStats)return;i&&(m=i);const a=O(),c=document.getElementById("en-stats-panel");if(c&&c.classList.add("hidden"),L===t&&_&&!a.classList.contains("hidden")){a.classList.add("hidden");return}if(L!==t&&(s=null,_=!1,L=t),a.classList.remove("hidden"),X(),_&&s){m&&U(a,m);return}a.innerHTML=`<div class="en-author-hdr"><span class="en-author-hdr-title">${C.user} ${M("title")}</span></div><div class="en-author-loading">${M("loading")}</div>`,m&&U(a,m);try{const b=await Y(t);if(L!==t)return;s=b,_=!0,a.innerHTML=V(b),F(a),m&&U(a,m)}catch{if(L!==t)return;a.innerHTML=`<div class="en-author-hdr"><span class="en-author-hdr-title">${C.user} ${M("title")}</span></div><div class="en-author-error">${M("error")}</div>`}},W=t=>{if(t.querySelector(".en-author-action-btn"))return;const i=D(t);if(!i||!I(t)||Z(t))return;const c=document.createElement("div");c.className="en-author-action-btn en-light-swipe",c.innerHTML=`<button type="button" class="en-author-action-btn-icon">${C.user}</button><strong class="en-author-action-btn-label">${M("buttonLabel")}</strong>`,c.onclick=b=>{b.preventDefault();const P=I(t);P&&R(P,c)},i.appendChild(c)},n=()=>{document.querySelectorAll("article[data-scroll-index]").forEach(t=>W(t))},l=()=>location.pathname.match(/^\/@([^\/]+)/)?.[1]||null,g=t=>{const i=document.querySelector(".en-browse-buttons");if(i)return i;let a=t;for(;a.parentElement&&getComputedStyle(a.parentElement).flexDirection!=="column";)a=a.parentElement;if(!a.parentElement)return null;const c=document.createElement("div");return c.className="en-browse-buttons",c.style.cssText="display: flex; gap: 16px; align-items: center; justify-content: center; padding: 4px 0;",a.parentElement.insertBefore(c,a),c},p=()=>{const t=document.querySelector('[data-e2e="browse-like-icon"]');if(!t)return;const i=t.closest('[class*="DivFlexCenterRow"]');if(!i)return;const a=g(i);if(!a)return;if(J()){a.querySelector(".en-author-action-btn")?.remove();return}if(a.querySelector(".en-author-action-btn")||!l())return;const b=document.createElement("div");b.className="en-author-action-btn en-light-swipe",b.innerHTML=`<button type="button" class="en-author-action-btn-icon">${C.user}</button><strong class="en-author-action-btn-label">${M("buttonLabel")}</strong>`,b.onclick=P=>{P.preventDefault();const A=l();A&&R(A,b)},a.appendChild(b)},x=()=>{const t=location.pathname.match(/^\/@([^\/]+)\/?$/);if(!t){document.getElementById("en-author-fab")?.remove();return}if(document.getElementById("en-author-fab"))return;const i=t[1],a=document.createElement("button");a.id="en-author-fab",a.className=`en-author-fab en-light-swipe${r.theme==="light"?" light":""}`,a.type="button",a.innerHTML=C.user,a.onclick=c=>{c.preventDefault(),c.stopPropagation(),R(i,a)},document.body.appendChild(a)},S=()=>{n(),p(),x()};window.addEventListener("resize",()=>{const t=document.getElementById("en-author-panel");t&&!t.classList.contains("hidden")&&t.classList.add("hidden")});const w=()=>{if(q(),O(),S(),!v){let t=!1;v=new MutationObserver(()=>{t||(t=!0,requestAnimationFrame(()=>{t=!1,S()}))}),v.observe(document.body,{childList:!0,subtree:!0})}};window.addEventListener("message",t=>{if(!(t.source!==window||t.data?.type!=="__EN_ACTIVE__")){if(!t.data.features?.authorStats){H();return}f.authorStats=!0,w()}});let T=location.pathname;setInterval(()=>{if(!f.authorStats)return;const t=location.pathname;if(t!==T){T=t;const i=document.getElementById("en-author-panel");i&&i.classList.add("hidden"),s=null,_=!1,L=null,m=null,/^\/@[^\/]+\/?$/.test(t)?x():document.getElementById("en-author-fab")?.remove()}},50)})();
})()
