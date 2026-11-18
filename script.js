(function(){
"use strict";
var BATCH=300, WATCH_BACK=100, CHUNK=60;
var feed=document.getElementById("feed"), sentinel=document.getElementById("sentinel");
var resultEl=document.getElementById("result"), countEl=document.getElementById("count"), dot=document.getElementById("dot");
var searchForm=document.getElementById("searchForm"), input=document.getElementById("searchInput");
var searchBtn=document.getElementById("searchBtn"), clearBtn=document.getElementById("clearBtn");
var dlg=document.getElementById("dlg"), dlgCard=document.getElementById("dlgCard");
var curated={}, posts={}, nextNum=1, ready=null, appending=false, watch=null, io=null, lastFocus=null;

/* ---------- deterministic generator (works on ID strings, no Number precision) ---------- */
var A=["Nyx","Kael","Vire","Zor","Lum","Axi","Orin","Sev","Kryo","Ther","Vanta","Ilu","Mox","Rael","Cyra","Drev","Esk","Fenn","Halo","Juno","Kair","Lyra","Myr","Nova","Oxa","Pyre","Quor","Riven","Sol","Tarn","Umbra","Vex","Wren","Xan","Yara","Zeph"];
var B=["valtor","rhoden","dusk","mere","thorne","sable","quill","vance","ember","crest","drift","flux","gale","holt","iris","jett","lark","mourn","nacre","onyx","prism","rook","shade","tide","veil","wisp","zenith","ward","bloom","strand"];
var ROLE=["signal archivist","night cartographer","orbit tinkerer","glass-city runner","quiet strategist","relic collector","sound designer","star-map reader","pattern hunter","ember keeper","deep-net explorer","horizon painter","gravity chef","story smith","neon botanist"];
var TRAIT=["collects unusual maps","logs every sunrise","trades rare stories","builds tiny worlds","studies lost languages","maps forgotten routes","sketches impossible machines","keeps a library of echoes","chases the last light","hosts midnight listening rooms"];
var WHERE=["the Crimson Quarter","the Violet Gate","the Cyan Reach","Sector Nine","the Lower Skyline","the Static Coast","the Ember Docks","the Hollow Arcade"];
function hash(s){var h=2166136261;for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function rng(seed){return function(){seed=(seed+0x6D2B79F5)|0;var t=Math.imul(seed^(seed>>>15),1|seed);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296}}
function pick(a,r){return a[Math.floor(r()*a.length)]}
var avCache=Object.create(null);
function avatar(id,name){
  var h=hash(id+"a"),hue=[350,350,350,268,188,0][h%6],hue2=(hue+40)%360,k=name.split(" "),ini=(k[0][0]+(k[1]?k[1][0]:"")).toUpperCase();
  return "data:image/svg+xml,"+encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='hsl("+hue+",80%,45%)'/><stop offset='1' stop-color='hsl("+hue2+",70%,12%)'/></linearGradient></defs><rect width='64' height='64' fill='url(#g)'/><text x='32' y='40' text-anchor='middle' font-family='sans-serif' font-size='24' font-weight='700' fill='#fff'>"+ini+"</text></svg>");
}
function make(id){
  if(curated[id])return curated[id];
  var r=rng(hash(id)), name=pick(A,r)+" "+pick(B,r).replace(/^./,function(c){return c.toUpperCase()});
  var desc="A "+pick(ROLE,r)+" from "+pick(WHERE,r)+" who "+pick(TRAIT,r)+".";
  return {id:id,name:name,desc:desc,img:"",url:"",gen:true};
}
function norm(s){s=String(s).replace(/\D/g,"").replace(/^0+/,"");return s}

/* ---------- data files ---------- */
function parseLines(text,cb){
  String(text).split(/\r?\n/).forEach(function(l){
    l=l.trim(); if(!l||l.charAt(0)==="#"||l.charAt(0)!=="$")return;
    l=l.replace(/^\$/,"").replace(/\$$/,""); cb(l.split("$"));
  });
}
function load(url){
  return fetch(url,{cache:"no-cache"}).then(function(r){if(!r.ok)throw 0;return r.text()}).catch(function(){return ""});
}
function safeUrl(u){u=(u||"").trim();return /^https?:\/\//i.test(u)?u:""}
function loadData(){
  return Promise.all([load("data/profiles.txt"),load("data/posts.txt")]).then(function(t){
    parseLines(t[0],function(f){
      var id=norm(f[0]); if(!id||!f[1]||curated[id])return;
      var g=make(id);
      curated[id]={id:id,name:f[1].trim(),desc:g.desc,img:safeUrl(f[2]),url:safeUrl(f[3]),gen:false};
    });
    parseLines(t[1],function(f){
      var id=norm(f[0]); if(!id||!f[1])return;
      (posts[id]=posts[id]||[]).push(f.slice(1).join("$").trim());
    });
  });
}

/* ---------- rendering ---------- */
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function avSrc(p){return p.img||avatar(p.id,p.name)}
function cardHTML(p){
  return '<a class="card" href="#p'+p.id+'" data-id="'+p.id+'"><div class="head"><img class="av" loading="lazy" decoding="async" width="56" height="56" alt="" src="'+esc(p.img||avatarCached(p))+'"><div style="min-width:0"><h2 class="name">'+esc(p.name)+'</h2><span class="idchip">'+p.id+'</span></div></div><p class="desc">'+esc(p.desc)+'</p><span class="open">Open profile</span></a>';
}
function avatarCached(p){return avatar(p.id,p.name)}
function prepare(){
  var out=[],n=nextNum;
  for(var i=0;i<BATCH;i++){out.push(make(String(n+i)))}
  nextNum=n+BATCH; return out;
}
function prepareLater(){
  var run=function(){dot.className="dot busy";ready=prepare();dot.className="dot"};
  if(window.requestIdleCallback)requestIdleCallback(run,{timeout:1500});else setTimeout(run,50);
}
function appendBatch(list,done){
  var i=0; appending=true;
  (function step(){
    var end=Math.min(i+CHUNK,list.length),html="";
    for(;i<end;i++)html+=cardHTML(list[i]);
    feed.insertAdjacentHTML("beforeend",html);
    if(i<list.length)requestAnimationFrame(step);
    else{appending=false;done&&done()}
  })();
}
function updateCount(){countEl.textContent=feed.children.length.toLocaleString("en-US")}
function setWatch(){
  if(io&&watch)io.unobserve(watch);
  var n=feed.children.length; watch=feed.children[Math.max(0,n-WATCH_BACK)];
  if(io&&watch)io.observe(watch);
}
function grow(){
  if(appending)return;
  var list=ready||prepare(); ready=null;
  appendBatch(list,function(){updateCount();setWatch();prepareLater()});
}
function checkFallback(){
  if(appending||!watch)return;
  if(watch.getBoundingClientRect().top<window.innerHeight*2)grow();
}
var ticking=false;
function onScroll(){if(ticking)return;ticking=true;requestAnimationFrame(function(){ticking=false;checkFallback()})}

/* ---------- search ---------- */
function showResult(raw){
  var digits=raw.replace(/\D/g,""),id=norm(raw);
  if(!digits){resultEl.hidden=true;resultEl.innerHTML="";return}
  resultEl.hidden=false;
  if(!id){resultEl.innerHTML='<p class="err">Profile IDs are positive whole numbers.</p>';return}
  resultEl.innerHTML=cardHTML(make(id));
}
var t=null;
input.addEventListener("input",function(){
  var clean=input.value.replace(/\D/g,"");
  if(clean!==input.value)input.value=clean;
  clearBtn.hidden=!clean;
  clearTimeout(t);t=setTimeout(function(){showResult(input.value)},120);
});
searchForm.addEventListener("submit",function(e){e.preventDefault();showResult(input.value);var id=norm(input.value);if(id)location.hash="p"+id});
searchBtn.addEventListener("click",function(){
  var open=searchForm.classList.toggle("open");
  searchBtn.setAttribute("aria-expanded",open);
  if(open)input.focus({preventScroll:true});
});
clearBtn.addEventListener("click",function(){input.value="";clearBtn.hidden=true;showResult("");input.focus({preventScroll:true})});

/* ---------- profile dialog (hash route: #p<ID>) ---------- */
function openProfile(id){
  var p=make(id),list=posts[id]||[];
  var h='<div class="head"><img class="av" alt="" src="'+esc(p.img||avatar(p.id,p.name))+'"><div style="min-width:0"><h2 class="name" id="dlgName">'+esc(p.name)+'</h2><span class="idchip">'+p.id+'</span></div></div><p class="desc">'+esc(p.desc)+'</p>';
  if(list.length){h+="<h3>Posts</h3>";list.forEach(function(x){h+='<p class="post">'+esc(x)+'</p>'})}
  h+='<div class="actions">'+(p.url?'<a href="'+esc(p.url)+'" target="_blank" rel="noopener noreferrer">Visit external link</a>':"")+'<button type="button" id="copyBtn">Copy ID</button><button type="button" id="closeBtn">Close</button></div>';
  dlgCard.innerHTML=h;
  var im=dlgCard.querySelector(".av");im.onerror=function(){im.onerror=null;im.src=avatar(p.id,p.name)};
  dlg.hidden=false;document.getElementById("closeBtn").focus({preventScroll:true});
  document.getElementById("closeBtn").onclick=closeProfile;
  document.getElementById("copyBtn").onclick=function(){
    var b=this;(navigator.clipboard?navigator.clipboard.writeText(p.id):Promise.reject()).then(function(){b.textContent="Copied"},function(){b.textContent="Copy not available"});
  };
}
function closeProfile(){
  dlg.hidden=true;
  if(location.hash){history.replaceState(null,"",location.pathname+location.search)}
  if(lastFocus&&lastFocus.focus)lastFocus.focus({preventScroll:true});
}
function route(){
  var m=/^#p(\d+)$/.exec(location.hash);
  if(m&&norm(m[1]))openProfile(norm(m[1]));else dlg.hidden=true;
}
document.addEventListener("click",function(e){
  var a=e.target.closest&&e.target.closest("a.card");
  if(a){lastFocus=a}
});
document.getElementById("dlgBg").addEventListener("click",closeProfile);
document.addEventListener("keydown",function(e){if(e.key==="Escape"&&!dlg.hidden)closeProfile()});
window.addEventListener("hashchange",route);

document.getElementById("brand").addEventListener("click",function(){window.scrollTo({top:0,behavior:"smooth"})});
document.getElementById("randomBtn").addEventListener("click",function(){
  var len=1+Math.floor(Math.random()*18),s=String(1+Math.floor(Math.random()*9));
  for(var i=1;i<len;i++)s+=Math.floor(Math.random()*10);
  location.hash="p"+s;
});

/* ---------- start ---------- */
loadData().then(function(){
  appendBatch(prepare(),function(){
    updateCount();
    if("IntersectionObserver" in window){
      io=new IntersectionObserver(function(en){
        for(var i=0;i<en.length;i++)if(en[i].isIntersecting){grow();break}
      },{rootMargin:"0px 0px 600px 0px"});
    }
    setWatch();
    window.addEventListener("scroll",onScroll,{passive:true});
    prepareLater();
    route();
  });
});
})();
