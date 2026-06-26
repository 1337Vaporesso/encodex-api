(function(){
var fileInput = document.getElementById('fileInput');
var patchBtn = document.getElementById('patchBtn');
var uploadTrigger = document.getElementById('uploadTrigger');
var fileName = document.getElementById('fileNameDisplay');

function _c(m,t){
  var e=document.createElement('div');
  e.className='toast '+(t||'info');
  e.textContent=m; document.body.appendChild(e);
  setTimeout(function(){e.remove()},3000);
}

function rs(v,p){return String.fromCharCode(v.getUint8(p),v.getUint8(p+1),v.getUint8(p+2),v.getUint8(p+3))}

function findStts(buf){
  function parse(offset,limit){
    var boxes=[],pos=offset,dv=new DataView(buf);
    while(pos+8<=limit){
      var size=dv.getUint32(pos),type=rs(dv,pos+4);
      if(size===0)break;
      if(size<8){pos+=8;continue}
      var end=Math.min(pos+size,limit);
      if(type==='stts')return{offset:pos,size:end-pos};
      if(type==='moov'||type==='trak'||type==='mdia'||type==='minf'||type==='stbl'){
        var r=parse(pos+8,end);
        if(r)return r;
      }
      pos=end;
    }
    return null;
  }
  return parse(0,buf.byteLength);
}

function patchVideo(buf){
  var stts=findStts(buf);
  if(!stts)return null;
  var dv=new DataView(buf);
  var off=stts.offset+8;
  var entryCount=dv.getUint32(off+4);
  if(entryCount===0||entryCount>100000)return null;
  if(entryCount===1&&dv.getUint32(off+12)===1)return null;
  var total=0,p=off+8;
  for(var i=0;i<entryCount;i++){total+=dv.getUint32(p);p+=8}
  if(total===0||total>1000000)return null;
  var oldSize=stts.size,newSize=24,sizeDiff=oldSize-newSize;
  var vf=dv.getUint32(off);
  var src=new Uint8Array(buf);
  var out=new Uint8Array(buf.byteLength-sizeDiff);
  var pos=0;
  out.set(src.subarray(0,stts.offset),pos);pos+=stts.offset;
  var hdr=new Uint8Array(8);var hdv=new DataView(hdr.buffer);
  hdv.setUint32(0,newSize);hdr[4]=115;hdr[5]=116;hdr[6]=116;hdr[7]=115;
  out.set(hdr,pos);pos+=8;
  var b0=new Uint8Array(8);var b0v=new DataView(b0.buffer);
  b0v.setUint32(0,vf);b0v.setUint32(4,1);
  out.set(b0,pos);pos+=8;
  var b1=new Uint8Array(8);var b1v=new DataView(b1.buffer);
  b1v.setUint32(0,total);b1v.setUint32(4,1);
  out.set(b1,pos);pos+=8;
  out.set(src.subarray(stts.offset+oldSize),pos);
  return out.buffer;
}

patchBtn.addEventListener('click',function(){
  var file=fileInput.files[0];
  if(!file){_c('Select a video first','error');return}
  var btn=patchBtn;
  btn.disabled=true;btn.textContent='Processing...';
  var fr=new FileReader();
  fr.onload=function(){
    var patched=patchVideo(fr.result);
    if(!patched){
      btn.disabled=false;btn.textContent='Patch & Download';
      _c('Already patched or unsupported','info');return;
    }
    var blob=new Blob([patched],{type:'video/mp4'});
    var url=URL.createObjectURL(blob);
    var a=document.createElement('a');
    a.href=url;a.download='encoded_'+file.name;
    document.body.appendChild(a);a.click();
    a.remove();URL.revokeObjectURL(url);
    btn.disabled=false;btn.textContent='Patch & Download';
    _c('Done!','success');
  };
  fr.onerror=function(){
    btn.disabled=false;btn.textContent='Patch & Download';
    _c('Error reading file','error');
  };
  fr.readAsArrayBuffer(file);
});

fileInput.addEventListener('change',function(){
  var f=this.files[0];
  if(f)fileName.textContent=f.name+' ('+(f.size/1024/1024).toFixed(1)+' MB)';
});
uploadTrigger.addEventListener('click',function(){fileInput.click()});
})();
