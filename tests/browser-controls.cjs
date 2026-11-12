// Run with node tests/browser-controls.cjs. Set CHROME_PATH on other platforms.
// The temporary site and browser profile keep these checks separate from user data.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'daylight-browser-'));
const browser = process.env.CHROME_PATH || (process.platform==='linux' ? 'google-chrome' : 'C:/Program Files/Google/Chrome/Application/chrome.exe');
for (const name of ['planner.js','app.js','styles.css','icon.svg']) fs.copyFileSync(path.join(root,name),path.join(dir,name));
function exercise() {
  const $ = s => document.querySelector(s);
  const state = () => JSON.parse(localStorage.getItem('daylight.planner.v1'));
  const assert = (ok,msg) => { if (!ok) throw Error(msg); };
  const action = (name,scope=document) => {
    const button=scope.querySelector('[data-action="'+name+'"]');
    assert(button,'Missing '+name); button.click();
  };
  const submit = id => { const f=$('#'+id); assert(f.reportValidity(),'Invalid '+id); f.querySelector('[type=submit]').click(); };
  const view = name => document.querySelector('[data-view="'+name+'"]').click();
  const value = (form,key,v) => { $('#'+form).elements.namedItem(key).value=v; };
  const finish = msg => { document.body.textContent=msg; };
  window.addEventListener('load',async ()=>{
    try {
      if(sessionStorage.getItem('reloading')){
        assert(state().tasks[0].title==='Prepare report','Task missing after reload');
        assert(state().events[0].title==='Protected meeting','Protected time missing after reload');
        finish('DAYLIGHT_BROWSER_PASS'); return;
      }
      if(!sessionStorage.getItem('demo-tested')){
        action('demo'); assert(state().tasks.length>0,'Demo did not load');
        localStorage.clear(); sessionStorage.setItem('demo-tested','1'); location.reload(); return;
      }
      submit('setup-form'); assert(state().configured,'Setup did not save');
      view('insights'); action('view-tasks'); view('day');
      action('add-event'); value('event-form','title','Protected meeting');
      value('event-form','start','07:00'); value('event-form','end','07:30');
      submit('event-form'); assert(state().events.length===1,'Protected slot did not save');
      action('add-task'); value('task-form','title','Prepare report');
      value('task-form','minutes','35'); value('task-form','block','15');
      value('task-form','requirements','Laptop'); value('task-form','steps','Draft outline');
      submit('task-form'); assert(state().tasks.length===1,'Task did not save');
      let p=Daylight.buildPlan(state(),state().tasks[0].date);
      assert(p.blocks.length===3 && p.blocks[0].start===450,'Expected first block at 07:30');
      assert(p.slots.slice(420,450).every(s=>s.kind==='event'),'Protected slot overwritten');
      assert($('#content').textContent.includes('Prepare report'),'Task missing from timeline');
      action('detail'); let box=$('#detail-dialog');
      box.querySelector('[data-checklist=requirements]').click();
      assert(Daylight.buildPlan(state(),p.date).waiting.length===1,'Requirement did not hold task');
      box.querySelector('[data-checklist=requirements]').click();
      box.querySelector('[data-checklist=steps]').click();
      submit('log-form'); assert(state().logs.length===1,'Duration log missing');
      action('edit-task',box); action('use-average'); submit('task-form');
      action('focus-next'); action('close-dialog',$('#focus-dialog'));
      action('focus'); action('timer-toggle'); assert(state().timer.startedAt,'Timer failed to start');
      action('timer-toggle'); action('timer-reset'); action('timer-finish');
      assert(Object.keys(state().doneBlocks).length,'Completion missing');
      action('toggle-block'); action('complete-task'); action('complete-task');
      action('toggle-minutes'); assert($('.minute-table tbody').rows.length===60,'Minute view missing');
      action('toggle-minutes'); action('prev'); action('next'); action('today');
      view('week'); action('calendar-detail'); action('close-dialog',$('#detail-dialog'));
      view('month'); assert(document.querySelectorAll('.month-cell').length===42,'Month grid missing');
      view('quarter'); value('goal-form','goal','Learn JS'); submit('goal-form');
      action('goal-toggle'); assert(state().goals[0].done,'Goal toggle failed');
      action('goal-delete'); action('confirm-yes'); action('open-date'); action('today');
      view('tasks'); action('template'); submit('task-form'); assert(state().tasks.length===2,'Template failed');
      const second=state().tasks[1].id;
      document.querySelector('[data-action=delete-task][data-id="'+second+'"]').click(); action('confirm-cancel');
      document.querySelector('[data-action=delete-task][data-id="'+second+'"]').click(); action('confirm-yes');
      action('edit-event'); submit('event-form');
      action('add-event'); value('event-form','title','Temporary slot'); submit('event-form');
      const extra=state().events[1].id;
      document.querySelector('[data-action=delete-event][data-id="'+extra+'"]').click(); action('confirm-yes');
      action('delete-event'); action('confirm-cancel'); assert(state().events.length===1,'Cancel removed event');
      view('insights'); action('log-delete'); action('confirm-yes');
      action('settings'); submit('setup-form'); view('day'); action('export');
      const downloads=[]; HTMLAnchorElement.prototype.click=function(){downloads.push(this.download);};
      for(const name of ['download-backup','download-csv','download-minutes','download-ics'])action(name,$('#export-dialog'));
      assert(downloads.length===4,'Export did not generate four download links');
      const transfer=new DataTransfer(); transfer.items.add(new File([JSON.stringify(state())],'planner.json',{type:'application/json'}));
      $('#import-file').files=transfer.files; $('#import-file').dispatchEvent(new Event('change',{bubbles:true}));
      for(let i=0;i<100&&!$('#confirm-dialog').open;i++)await new Promise(resolve=>setTimeout(resolve,10));
      assert($('#confirm-dialog').open,'Restore did not request confirmation'); action('confirm-yes');
      action('next'); view('tasks'); action('detail'); action('move-task'); action('confirm-yes'); action('close-dialog',$('#detail-dialog'));
      action('export'); let printed=false; window.print=()=>{printed=true;}; action('print'); assert(printed,'Print handler failed');
      sessionStorage.setItem('reloading','1'); location.reload();
    }catch(e){finish('DAYLIGHT_BROWSER_FAIL '+e.stack);}
  });
}
const html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace('</body>',()=>'<script>('+exercise.toString()+')();</script></body>');
fs.writeFileSync(path.join(dir,'index.html'),html);
const result=spawnSync(browser,['--headless','--disable-gpu','--no-first-run','--no-default-browser-check','--user-data-dir='+path.join(dir,'profile'),'--virtual-time-budget=3500','--dump-dom',pathToFileURL(path.join(dir,'index.html')).href],{encoding:'utf8',windowsHide:true,timeout:35000,maxBuffer:8e6});
if(!/<body>DAYLIGHT_BROWSER_PASS<\/body>/.test(result.stdout||'')){
  console.error((result.stdout||'').match(/<body>DAYLIGHT_BROWSER_FAIL[^<]+/)?.[0]||result.error?.message||result.stderr||('Browser exited '+result.status+' '+result.signal+' '+(result.stdout||'').slice(-350))); process.exitCode=1;
}else console.log('Browser controls, task scheduling, protected time and persistence after reload passed.');
