(function(){
var f=document.getElementById('fileInput');
var b=document.getElementById('patchBtn');
var u=document.getElementById('uploadTrigger');
var n=document.getElementById('fileNameDisplay');
function t(m,x){
  var e=document.createElement('div');
  e.className='toast '+(x||'info');
  e.textContent=m;document.body.appendChild(e);
  setTimeout(function(){e.remove()},3000);
}
b.addEventListener('click',function(){
  var v=f.files[0];
  if(!v){t('Select a video first','error');return}
  if(v.size>100*1024*1024){t('File too large (max 100MB)','error');return}
  var o=b;
  o.disabled=true;o.textContent='Uploading...';
  chrome.storage.local.get('encodex_token',function(r){
    if(!r||!r.encodex_token){
      o.disabled=false;o.textContent='Patch & Download';
      t('Login required','error');return;
    }
    var fd=new FormData();
    fd.append('video',v);
    var ac=new AbortController();
    var to=setTimeout(function(){ac.abort()},120000);
    fetch('https://encodex-api-production.up.railway.app/api/process/quick',{
      method:'POST',
      headers:{'Authorization':'Bearer '+r.encodex_token},
      body:fd,
      signal:ac.signal
    }).then(function(resp){
      clearTimeout(to);
      if(!resp.ok){return resp.json().then(function(d){throw new Error(d.error||'Server error')})}
      o.textContent='Downloading...';
      return resp.blob();
    }).then(function(blob){
      var url=URL.createObjectURL(blob);
      var a=document.createElement('a');
      a.href=url;a.download='encoded_'+v.name;
      document.body.appendChild(a);a.click();
      a.remove();URL.revokeObjectURL(url);
      o.disabled=false;o.textContent='Patch & Download';
      t('Done!','success');
    }).catch(function(e){
      clearTimeout(to);
      o.disabled=false;o.textContent='Patch & Download';
      if(e.name==='AbortError'){t('Server timeout','error')}
      else{t(e.message||'Server error','error')}
    });
  });
});
f.addEventListener('change',function(){
  var v=this.files[0];
  if(v)n.textContent=v.name+' ('+(v.size/1048576).toFixed(1)+' MB)';
});
u.addEventListener('click',function(){f.click()});
})();
