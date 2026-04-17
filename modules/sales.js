// modules/sales.js - Ban hang
import { registerRoute } from '../core/router.js';
import { addItem, updateItem, deleteItem, onSnapshot } from '../core/db.js';
import { toast, showModal, formatVND } from '../core/ui.js';
import { isAdmin } from '../core/auth.js';
const COLLECTION = 'sales';
registerRoute('#sales', mount);
export async function mount(container) {
  const todayISO = new Date().toISOString().slice(0, 10);
  container.innerHTML = `<div style="text-align:center;padding:1.25rem 1rem 0.75rem">
    <h2 style="margin:0 0 0.75rem;font-size:1.4rem">Ban hang</h2>
    <button id="sale-add" class="btn btn--primary" style="min-width:160px;font-size:1rem;margin-bottom:0.75rem">+ Ban hang</button>
    <div style="display:flex;gap:0.5rem;align-items:center;justify-content:center;flex-wrap:wrap">
      <label style="font-weight:500">Ngay:</label>
      <input id="sale-date-filter" type="date" value="${todayISO}" style="padding:0.3rem 0.6rem;border:1px solid #cbd5e0;border-radius:6px;font-size:0.9rem"/>
      <span id="sale-count" style="color:#718096;font-size:0.85rem"></span>
    </div>
  </div>
  <div id="sale-form-wrap"></div>
  <div id="sale-list-wrap" style="padding:0.75rem 1rem 2rem"></div>`;
  let allData = [], selectedKey = null;
  const unsub = onSnapshot(COLLECTION, items => { allData = items.sort((a,b)=>(b.ts||0)-(a.ts||0)); renderList(); });
  container.addEventListener('unmount', () => unsub && unsub());
  document.getElementById('sale-date-filter').addEventListener('change', () => { selectedKey=null; renderList(); });
  document.getElementById('sale-add').addEventListener('click', () => openForm(null));
  function getFiltered() {
    const iso = document.getElementById('sale-date-filter').value;
    if (!iso) return allData;
    const ds = iso.split('-').reverse().join('/');
    return allData.filter(s => (s.date||'') === ds);
  }
  function renderList() {
    const data = getFiltered(), wrap = document.getElementById('sale-list-wrap'), cnt = document.getElementById('sale-count');
    if (cnt) cnt.textContent = '(' + data.length + ' phieu)';
    if (!data.length) { wrap.innerHTML = '<p style="text-align:center;color:#888;padding:2rem">Khong co phieu ban trong ngay nay</p>'; return; }
    wrap.innerHTML = data.map(s => {
      const sel = s._key === selectedKey, remain = (s.total||0)-(s.paid||0), rc = remain>0?'#e53e3e':'#38a169';
      const its = s.items||[], sm = !its.length?'':its.length===1?its[0].name:its[0].name+' (+'+(its.length-1)+')';
      return `<div class="sale-card" data-key="${s._key}" style="background:#fff;border:1.5px solid ${sel?'#4299e1':'#e2e8f0'};border-radius:10px;margin-bottom:0.65rem;box-shadow:${sel?'0 0 0 3px #bee3f8':'0 1px 3px rgba(0,0,0,0.07)'};cursor:pointer;transition:all 0.18s">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:0.7rem 1rem;gap:1rem;flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:0.65rem;flex:1;min-width:0">
            <input type="checkbox" class="sale-chk" data-key="${s._key}" ${sel?'checked':''} style="width:17px;height:17px;cursor:pointer;flex-shrink:0" onclick="event.stopPropagation()"/>
            <div style="min-width:0"><div style="font-weight:600;color:#2d3748">${s.billNo||'—'}</div><div style="font-size:0.8rem;color:#718096">${s.customer||''}${s.phone?' · '+s.phone:''}</div></div>
          </div>
          <div style="text-align:right;flex-shrink:0"><div style="font-weight:700;color:#2b6cb0">${formatVND(s.total||0)}</div><div style="font-size:0.8rem;color:${rc}">${remain>0?'Con: '+formatVND(remain):'Da thanh toan'}</div></div>
        </div>
        ${sel?`<div style="border-top:1px solid #e2e8f0;padding:0.6rem 1rem;display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;background:#f7fafc">
          <span style="font-size:0.83rem;color:#4a5568;flex:1">${sm} · ${s.paymethod||''}</span>
          <button class="btn btn--sm btn--secondary sale-view" data-key="${s._key}" onclick="event.stopPropagation()">Chi tiet</button>
          <button class="btn btn--sm btn--secondary sale-edit" data-key="${s._key}" onclick="event.stopPropagation()">Sua</button>
          ${isAdmin()?'<button class="btn btn--sm btn--danger sale-del" data-key="'+s._key+'" onclick="event.stopPropagation()">Xoa</button>':''}
        </div>`:''}
      </div>`;
    }).join('');
    wrap.querySelectorAll('.sale-card').forEach(c => c.addEventListener('click', () => { selectedKey=selectedKey===c.dataset.key?null:c.dataset.key; renderList(); }));
    wrap.querySelectorAll('.sale-chk').forEach(k => k.addEventListener('change', () => { selectedKey=k.checked?k.dataset.key:null; renderList(); }));
    wrap.querySelectorAll('.sale-view').forEach(b => b.addEventListener('click', () => showDetail(allData.find(s=>s._key===b.dataset.key))));
    wrap.querySelectorAll('.sale-edit').forEach(b => b.addEventListener('click', () => openForm(allData.find(s=>s._key===b.dataset.key))));
    wrap.querySelectorAll('.sale-del').forEach(b => b.addEventListener('click', () => confirmDelete(b.dataset.key)));
  }
  function showDetail(sale) {
    if (!sale) return;
    const fw = document.getElementById('sale-form-wrap');
    const rows = (sale.items||[]).map(it => `<tr><td>${it.code||''}</td><td>${it.name||''}</td><td style="text-align:right">${it.qty||1}</td><td>${it.unit||''}</td><td style="text-align:right">${formatVND(it.price||0)}</td><td style="text-align:right">${formatVND(it.disc||0)}</td><td style="text-align:right">${formatVND((it.price||0)*(it.qty||1)-(it.disc||0))}</td><td>${it.prodWarranty||0}th</td></tr>`).join('');
    fw.innerHTML = `<div class="repair-overlay" style="position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:200;display:flex;align-items:center;justify-content:center;padding:1rem"><div style="background:#fff;border-radius:12px;padding:1.5rem 2rem;max-width:720px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3)">
      <h3 style="margin:0 0 1rem;text-align:center">Chi tiet - ${sale.billNo||''}</h3>
      <div class="form-grid" style="margin-bottom:1rem"><div><b>Khach:</b> ${sale.customer||''}</div><div><b>SDT:</b> ${sale.phone||''}</div><div><b>Ngay:</b> ${sale.date||''}</div><div><b>TT:</b> ${sale.paymethod||''}</div><div><b>BH:</b> ${sale.warranty||0}th</div><div><b>Note:</b> ${sale.note||''}</div></div>
      <table class="data-table" style="margin-bottom:1rem"><thead><tr><th>Ma</th><th>Ten SP</th><th>SL</th><th>DVT</th><th>Don gia</th><th>CK</th><th>Thanh tien</th><th>BH</th></tr></thead><tbody>${rows}</tbody></table>
      <div style="text-align:right"><div>Tam tinh:<b>${formatVND(sale.subtotal||sale.total||0)}</b></div>${sale.extraDiscount?'<div>Giam them:<b>-'+formatVND(sale.extraDiscount)+'</b></div>':''}<div>Tong:<b style="color:#2b6cb0">${formatVND(sale.total||0)}</b></div><div>Khach tra:<b>${formatVND(sale.paid||0)}</b></div><div>Tien thua:<b>${formatVND(sale.change||0)}</b></div></div>
      <div class="form-actions" style="justify-content:center;margin-top:1rem"><button id="det-close" class="btn btn--secondary">Dong</button></div>
    </div></div>`;
    const cl=()=>{fw.innerHTML='';};
    document.getElementById('det-close').addEventListener('click',cl);
    fw.querySelector('.repair-overlay').addEventListener('click',e=>{if(e.target===fw.querySelector('.repair-overlay'))cl();});
  }
  function openForm(record) {
    const fw=document.getElementById('sale-form-wrap'), tdDef=new Date().toISOString().slice(0,10);
    const items=record?.items?[...record.items]:[{id:Date.now(),code:'',name:'',qty:1,unit:'Cai',price:0,disc:0,prodWarranty:0}];
    function render(){
      const rows=items.map((it,i)=>`<tr data-idx="${i}"><td><input class="ic" type="text" value="${it.code||''}" placeholder="Ma" style="width:65px"/></td><td><input class="in" type="text" value="${it.name||''}" placeholder="Ten SP" style="width:155px"/></td><td><input class="iq" type="number" value="${it.qty||1}" style="width:48px"/></td><td><input class="iu" type="text" value="${it.unit||'Cai'}" style="width:42px"/></td><td><input class="ip" type="number" value="${it.price||0}" style="width:90px"/></td><td><input class="id" type="number" value="${it.disc||0}" style="width:70px"/></td><td><input class="iw" type="number" value="${it.prodWarranty||0}" style="width:48px"/></td><td><button class="btn btn--sm btn--danger ir" data-i="${i}">x</button></td></tr>`).join('');
      fw.innerHTML=`<div class="repair-overlay" style="position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:200;display:flex;align-items:center;justify-content:center;padding:1rem"><div style="background:#fff;border-radius:12px;padding:1.5rem 2rem;max-width:760px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3)">
        <h3 style="margin:0 0 1rem;text-align:center">${record?'Cap nhat':'Lap phieu ban hang'}</h3>
        <div class="form-grid">
          <div class="form-group"><label>So bill</label><input id="f-bill" type="text" value="${record?.billNo||''}" placeholder="Tu dong"/></div>
          <div class="form-group"><label>Ngay ban</label><input id="f-date" type="date" value="${record?.date?record.date.split('/').reverse().join('-'):tdDef}"/></div>
          <div class="form-group"><label>Khach hang *</label><input id="f-cust" type="text" value="${record?.customer||''}"/></div>
          <div class="form-group"><label>SDT</label><input id="f-phone" type="text" value="${record?.phone||''}"/></div>
          <div class="form-group"><label>Hinh thuc TT</label><select id="f-pay">${['Tien mat','Chuyen khoan','Cong no'].map(p=>'<option'+(record?.paymethod===p?' selected':'')+'>'+p+'</option>').join('')}</select></div>
          <div class="form-group"><label>BH may (thang)</label><input id="f-war" type="number" value="${record?.warranty||0}"/></div>
          <div class="form-group"><label>Giam them (d)</label><input id="f-exd" type="number" value="${record?.extraDiscount||0}"/></div>
          <div class="form-group"><label>Khach tra (d)</label><input id="f-paid" type="number" value="${record?.paid||0}"/></div>
          <div class="form-group" style="grid-column:1/-1"><label>Ghi chu</label><input id="f-note" type="text" value="${record?.note||''}"/></div>
        </div>
        <h4 style="margin:.75rem 0 .25rem">San pham</h4>
        <div style="overflow-x:auto"><table class="data-table"><thead><tr><th>Ma</th><th>Ten SP</th><th>SL</th><th>DVT</th><th>Gia</th><th>CK</th><th>BH</th><th></th></tr></thead><tbody id="itb">${rows}</tbody></table></div>
        <button id="add-row" class="btn btn--secondary" style="margin-top:.5rem">+ Them dong</button>
        <div id="f-tot" style="text-align:right;margin-top:.5rem;font-weight:600;color:#2b6cb0"></div>
        <div class="form-actions" style="justify-content:center;gap:1rem;margin-top:1rem">
          <button id="f-save" class="btn btn--primary" style="min-width:120px">${record?'Cap nhat':'Luu phieu'}</button>
          <button id="f-cancel" class="btn btn--secondary">Huy</button>
        </div>
      </div></div>`;
      calcTotal();
      fw.querySelectorAll('.ir').forEach(b=>b.addEventListener('click',()=>{items.splice(+b.dataset.i,1);if(!items.length)items.push({id:Date.now(),code:'',name:'',qty:1,unit:'Cai',price:0,disc:0,prodWarranty:0});render();}));
      fw.querySelector('#add-row').addEventListener('click',()=>{items.push({id:Date.now(),code:'',name:'',qty:1,unit:'Cai',price:0,disc:0,prodWarranty:0});render();});
      fw.querySelectorAll('#itb input').forEach(inp=>inp.addEventListener('input',syncItems));
      document.getElementById('f-exd')?.addEventListener('input',calcTotal);
      document.getElementById('f-paid')?.addEventListener('input',calcTotal);
      document.getElementById('f-cancel').addEventListener('click',()=>{fw.innerHTML='';});
      document.getElementById('f-save').addEventListener('click',save);
      fw.querySelector('.repair-overlay').addEventListener('click',e=>{if(e.target===fw.querySelector('.repair-overlay'))fw.innerHTML='';});
    }
    function syncItems(){fw.querySelectorAll('#itb tr').forEach((row,i)=>{if(!items[i])return;items[i].code=row.querySelector('.ic').value.trim();items[i].name=row.querySelector('.in').value.trim();items[i].qty=parseFloat(row.querySelector('.iq').value)||1;items[i].unit=row.querySelector('.iu').value.trim();items[i].price=parseFloat(row.querySelector('.ip').value)||0;items[i].disc=parseFloat(row.querySelector('.id').value)||0;items[i].prodWarranty=parseInt(row.querySelector('.iw').value)||0;});calcTotal();}
    function calcTotal(){syncItems();const sub=items.reduce((s,it)=>s+(it.price||0)*(it.qty||1)-(it.disc||0),0),exd=parseFloat(document.getElementById('f-exd')?.value)||0,tot=sub-exd,paid=parseFloat(document.getElementById('f-paid')?.value)||0,el=document.getElementById('f-tot');if(el)el.innerHTML='Tam tinh:'+formatVND(sub)+' | Tong:'+formatVND(tot)+' | Thua:'+formatVND(paid-tot);}
    async function save(){syncItems();const cust=document.getElementById('f-cust').value.trim();if(!cust){toast('Vui long nhap khach hang','error');return;}const valid=items.filter(it=>it.name);if(!valid.length){toast('Vui long nhap san pham','error');return;}const dv=document.getElementById('f-date').value,ds=dv?dv.split('-').reverse().join('/'):'',exd=parseFloat(document.getElementById('f-exd').value)||0,sub=valid.reduce((s,it)=>s+(it.price||0)*(it.qty||1)-(it.disc||0),0),tot=sub-exd,paid=parseFloat(document.getElementById('f-paid').value)||0;const data={billNo:document.getElementById('f-bill').value.trim()||(ds.replace(/\/g,'')+'-'+Math.floor(Math.random()*90+10)),date:ds,customer:cust,phone:document.getElementById('f-phone').value.trim(),items:valid,subtotal:sub,extraDiscount:exd,total:tot,paid,change:paid-tot,paymethod:document.getElementById('f-pay').value,warranty:parseInt(document.getElementById('f-war').value)||0,note:document.getElementById('f-note').value.trim(),ts:record?.ts||Date.now()};try{if(record){await updateItem(COLLECTION,record._key,data);toast('Da cap nhat');}else{await addItem(COLLECTION,data);toast('Da them phieu');}fw.innerHTML='';}catch(e){toast('Loi: '+e.message,'error');}}
    render();
  }
  async function confirmDelete(key){const ok=await showModal('Xac nhan','Xoa don hang nay?',true);if(!ok)return;try{await deleteItem(COLLECTION,key);toast('Da xoa');}catch(e){toast('Loi: '+e.message,'error');}}
}
