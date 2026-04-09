#!/usr/bin/env node
/**
 * TCC Payroll Hub — Index.html Patcher
 * 
 * Run this in the same directory as your current index.html:
 *   node apply-patches.js
 * 
 * It reads your current index.html, applies the 6 modifications for:
 *   - Payroll Archives nav + page
 *   - Overtime View nav + page  
 *   - Save to Archive button on payroll report
 * 
 * Outputs: index-patched.html (your new file to deploy)
 * 
 * NO DATA IS MODIFIED. This only changes the front-end code.
 */

const fs = require('fs');

const inputFile = 'index.html';
const outputFile = 'index-patched.html';

if (!fs.existsSync(inputFile)) {
  console.error(`ERROR: ${inputFile} not found in current directory.`);
  console.error('Run this script in the same folder as your TCC Payroll Hub index.html');
  process.exit(1);
}

let content = fs.readFileSync(inputFile, 'utf8');
const originalLen = content.length;
let modCount = 0;

function applyMod(name, find, replace) {
  if (!content.includes(find)) {
    console.error(`WARNING: Could not find target for ${name}`);
    console.error(`Looking for: ${find.substring(0, 80)}...`);
    return false;
  }
  content = content.replace(find, replace);
  modCount++;
  console.log(`✅ ${name}`);
  return true;
}

// MOD 1: Add nav items
applyMod('Mod 1: Nav items',
  `{ id: 'archive', icon: '📦', label: 'Archive', roles: ['owner','payroll'] },`,
  `{ id: 'archive', icon: '📦', label: 'Archive', roles: ['owner','payroll'] },
      { id: 'payroll-archives', icon: '🗂️', label: 'Payroll Archives', roles: ['owner','payroll'] },
      { id: 'overtime-view', icon: '⏱️', label: 'Overtime View', roles: ['owner','payroll'] },`
);

// MOD 2: Add page titles
applyMod('Mod 2: Page titles',
  `'signature': 'Signature Settings'`,
  `'signature': 'Signature Settings',
    'payroll-archives': 'Payroll Report Archives',
    'overtime-view': 'Overtime View'`
);

// MOD 3: Add renderers
applyMod('Mod 3: Renderers',
  `'signature': renderSignature`,
  `'signature': renderSignature,
    'payroll-archives': renderPayrollArchives,
    'overtime-view': renderOvertimeView`
);

// MOD 4: Save to Archive button
applyMod('Mod 4: Archive button',
  `let html = \`<div style="font-size:12px;color:var(--gray-600);margin-bottom:12px">
      <strong>Period:</strong> \${data.payPeriod.label} · <strong>Generated:</strong> \${new Date().toLocaleString()}
    </div>\`;`,
  `// Store report data for archiving
    window._lastPayrollReportData = data;

    let html = \`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div style="font-size:12px;color:var(--gray-600)">
        <strong>Period:</strong> \${data.payPeriod.label} · <strong>Generated:</strong> \${new Date().toLocaleString()}
      </div>
      <button class="btn btn-gold btn-sm" onclick="savePayrollArchive()">🗂️ Save to Archive</button>
    </div>\`;`
);

// MOD 5: State variables
applyMod('Mod 5: State variables',
  'let pendingIncreases = 0;',
  `let pendingIncreases = 0;
let otViewCenter = 'all';
let otViewShowAll = false;`
);

// MOD 6: New functions (insert before INIT section)
const newFunctions = `
// ========================
// PAYROLL REPORT ARCHIVES
// ========================

async function savePayrollArchive() {
  const data = window._lastPayrollReportData;
  if (!data) { alert('Generate a payroll report first.'); return; }
  try {
    await api('/api/payroll-archives', { method: 'POST', body: {
      period_start: data.payPeriod.start,
      period_end: data.payPeriod.end,
      pay_date: data.payPeriod.payDate,
      period_label: data.payPeriod.label,
      report_data: data,
      notes: null
    }});
    alert('Payroll report archived for ' + data.payPeriod.label + '. You can view it anytime from Payroll Archives.');
  } catch(e) { alert('Error saving archive: ' + e.message); }
}

async function renderPayrollArchives() {
  const el = document.getElementById('pageContent');
  let archives = [];
  try { archives = await api('/api/payroll-archives'); } catch(e) {}

  let html = \`<div class="card"><div class="card-header"><h3>Payroll Report Archives (\${archives.length})</h3>
    <div style="font-size:12px;color:var(--gray-400)">Frozen snapshots of payroll reports</div></div><div class="card-body">\`;

  if (archives.length === 0) {
    html += \`<div class="empty-state"><div class="icon">🗂️</div><p>No archived reports yet. Generate a payroll report and click "Save to Archive" to create one.</p></div>\`;
  } else {
    html += \`<table class="data-table"><thead><tr><th>Pay Period</th><th>Pay Date</th><th>Archived By</th><th>Archived On</th><th>Actions</th></tr></thead><tbody>\`;
    archives.forEach(a => {
      const payDate = a.pay_date ? new Date(a.pay_date + 'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—';
      const archivedOn = new Date(a.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});
      html += \`<tr>
        <td><strong>\${a.period_label || a.period_start + ' - ' + a.period_end}</strong></td>
        <td>\${payDate}</td>
        <td>\${a.generated_by || '—'}</td>
        <td style="font-size:12px">\${archivedOn}</td>
        <td style="white-space:nowrap">
          <button class="btn btn-primary btn-sm" onclick="viewArchivedReport(\${a.id})">View Report</button>
          \${currentUser.role === 'owner' ? \`<button class="btn btn-outline btn-sm" onclick="deleteArchive(\${a.id})" style="color:var(--danger)">✕</button>\` : ''}
        </td></tr>\`;
    });
    html += \`</tbody></table>\`;
  }
  html += \`</div></div>\`;
  el.innerHTML = html;
}

async function deleteArchive(id) {
  if (!confirm('Delete this archived report? This cannot be undone.')) return;
  try {
    await api(\`/api/payroll-archives/\${id}\`, { method: 'DELETE' });
    renderPayrollArchives();
  } catch(e) { alert('Error: ' + e.message); }
}

async function viewArchivedReport(id) {
  try {
    const archive = await api(\`/api/payroll-archives/\${id}\`);
    const data = archive.report_data;
    if (!data || !data.report) { alert('Archive data is empty or corrupted.'); return; }

    let html = \`<div class="modal-header"><h3>Archived Report — \${archive.period_label || ''}</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>\`;
    html += \`<div class="modal-body">\`;
    html += \`<div style="background:var(--gold-pale);padding:10px 14px;border-radius:8px;margin-bottom:16px;font-size:12px">
      <strong>Archived snapshot</strong> — saved by \${archive.generated_by || 'unknown'} on \${new Date(archive.created_at).toLocaleString()}.
      This shows the report exactly as it was at the time of archiving.</div>\`;

    const byCenter = {};
    data.report.forEach(r => { if (!byCenter[r.center]) byCenter[r.center] = []; byCenter[r.center].push(r); });

    for (const [ctr, emps] of Object.entries(byCenter)) {
      html += \`<h4 style="font-size:14px;font-weight:700;color:var(--navy);margin:16px 0 8px;padding-bottom:6px;border-bottom:2px solid var(--gold-pale)">\${ctr}</h4>\`;
      html += \`<div class="table-scroll"><table class="data-table"><thead><tr><th>Name</th><th>Reg Hrs</th><th>OT Hrs</th><th>Total Hrs</th><th>PTO Days</th></tr></thead><tbody>\`;
      let ctrReg = 0, ctrOT = 0, ctrTotal = 0;
      emps.sort((a,b) => a.last_name.localeCompare(b.last_name));
      emps.forEach(e => {
        ctrReg += e.regularHours; ctrOT += e.overtimeHours; ctrTotal += e.totalHours;
        html += \`<tr><td><strong>\${e.last_name}, \${e.first_name}</strong></td>
          <td style="font-family:'JetBrains Mono',monospace">\${e.regularHours.toFixed(2)}</td>
          <td style="font-family:'JetBrains Mono',monospace;\${e.overtimeHours > 0 ? 'color:var(--danger);font-weight:700' : ''}">\${e.overtimeHours > 0 ? e.overtimeHours.toFixed(2) : '—'}</td>
          <td style="font-family:'JetBrains Mono',monospace;font-weight:600">\${e.totalHours.toFixed(2)}</td>
          <td>\${e.ptoDays > 0 ? e.ptoDays + 'd' : '—'}</td></tr>\`;
      });
      html += \`<tr style="background:var(--navy);color:white;font-weight:700"><td>TOTAL — \${ctr}</td>
        <td style="font-family:'JetBrains Mono',monospace">\${ctrReg.toFixed(2)}</td>
        <td style="font-family:'JetBrains Mono',monospace">\${ctrOT.toFixed(2)}</td>
        <td style="font-family:'JetBrains Mono',monospace">\${ctrTotal.toFixed(2)}</td><td></td></tr>\`;
      html += \`</tbody></table></div>\`;
    }

    if (data.terminations && data.terminations.length > 0) {
      html += \`<h4 style="font-size:14px;font-weight:700;color:var(--danger);margin:16px 0 8px;padding-bottom:6px;border-bottom:2px solid #F09595">Terminations</h4>\`;
      html += \`<table class="data-table"><thead><tr><th>Name</th><th>Center</th><th>Last Day</th><th>Reason</th></tr></thead><tbody>\`;
      data.terminations.forEach(t => {
        html += \`<tr><td><strong>\${t.last_name}, \${t.first_name}</strong></td><td>\${t.center}</td>
          <td>\${t.terminated_date ? new Date(t.terminated_date).toLocaleDateString() : '—'}</td>
          <td style="font-size:11px">\${t.termination_reason || '—'}</td></tr>\`;
      });
      html += \`</tbody></table>\`;
    }
    html += \`</div>\`;
    document.getElementById('modalContent').innerHTML = html;
    document.getElementById('modalOverlay').classList.add('active');
  } catch(e) { alert('Error loading archive: ' + e.message); }
}

// ========================
// OVERTIME VIEW (all employees)
// ========================
async function renderOvertimeView() {
  const el = document.getElementById('pageContent');
  el.innerHTML = \`<div style="text-align:center;padding:40px"><em style="color:var(--gray-400)">Loading overtime data...</em></div>\`;
  try {
    const pp = payPeriod;
    const centerParam = otViewCenter !== 'all' ? \`&center=\${encodeURIComponent(otViewCenter)}\` : '';
    const data = await api(\`/api/overtime-view?date=\${pp.start}\${centerParam}\`);
    let html = '';
    html += \`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
      <button class="btn btn-outline btn-sm" onclick="navOTView(-1)">◀ Previous Period</button>
      <div style="text-align:center"><div style="font-size:16px;font-weight:700;color:var(--navy)">\${data.payPeriod.label}</div>
      <div style="font-size:12px;color:var(--gray-400)">Overtime View · Mon–Sun weeks</div></div>
      <button class="btn btn-outline btn-sm" onclick="navOTView(1)">Next Period ▶</button></div>\`;
    html += \`<div class="center-tabs"><div class="center-tab \${otViewCenter === 'all' ? 'active' : ''}" onclick="otViewCenter='all';renderOvertimeView()">All Centers</div>\`;
    CENTERS.forEach(c => { html += \`<div class="center-tab \${otViewCenter === c ? 'active' : ''}" onclick="otViewCenter='\${c}';renderOvertimeView()">\${c}</div>\`; });
    html += \`</div>\`;
    const otEmployees = data.employees.filter(e => e.hasOT);
    const withHours = data.employees.filter(e => e.hasHours);
    const displayEmployees = otViewShowAll ? withHours : otEmployees;
    html += \`<div style="display:flex;align-items:center;gap:16px;margin-bottom:16px">
      <button class="btn \${otViewShowAll ? 'btn-outline' : 'btn-primary'} btn-sm" onclick="otViewShowAll=false;renderOvertimeView()">⚠️ OT Only (\${otEmployees.length})</button>
      <button class="btn \${otViewShowAll ? 'btn-primary' : 'btn-outline'} btn-sm" onclick="otViewShowAll=true;renderOvertimeView()">👥 All Staff with Hours (\${withHours.length})</button></div>\`;
    if (displayEmployees.length === 0) {
      html += \`<div class="empty-state"><div class="icon">⏱️</div><p>\${otViewShowAll ? 'No hours recorded for this period yet.' : 'No overtime detected this period.'}</p></div>\`;
    } else {
      const weeks = displayEmployees[0].weeks;
      html += \`<div class="card"><div class="card-body"><div class="table-scroll"><table class="data-table" style="font-size:11px"><thead><tr>
        <th style="min-width:160px;position:sticky;left:0;background:var(--gray-50);z-index:2">Employee</th><th>Center</th>\`;
      weeks.forEach((w, wi) => {
        w.days.forEach(d => {
          const inPP = d.date >= data.payPeriod.start && d.date <= data.payPeriod.end;
          html += \`<th style="text-align:center;min-width:40px;font-size:9px;\${!inPP ? 'background:var(--gray-200);color:var(--gray-400)' : ''}">\${d.dayName.charAt(0)}<br>\${new Date(d.date + 'T12:00:00').getDate()}</th>\`;
        });
        html += \`<th style="text-align:center;min-width:50px;background:var(--navy);color:white;font-size:10px">Wk\${wi+1}</th>\`;
      });
      html += \`<th style="text-align:center;min-width:55px;background:var(--gold);color:white">Period</th>
        <th style="text-align:center;min-width:50px;background:var(--danger);color:white">OT</th></tr></thead><tbody>\`;
      let currentCtr = '';
      const sorted = [...displayEmployees].sort((a,b) => { if (a.center !== b.center) return a.center.localeCompare(b.center); return a.last_name.localeCompare(b.last_name); });
      sorted.forEach(emp => {
        if (otViewCenter === 'all' && emp.center !== currentCtr) {
          currentCtr = emp.center;
          const colSpan = 3 + weeks.reduce((sum, w) => sum + w.days.length + 1, 0) + 2;
          html += \`<tr style="background:var(--navy);color:white"><td colspan="\${colSpan}" style="padding:6px 14px;font-weight:700">\${currentCtr}</td></tr>\`;
        }
        const hasOT = emp.hasOT;
        html += \`<tr style="\${hasOT ? 'background:var(--danger-bg)' : ''}">
          <td style="position:sticky;left:0;background:\${hasOT ? 'var(--danger-bg)' : 'white'};z-index:1;font-weight:600">\${emp.last_name}, \${emp.first_name}</td>
          <td style="font-size:10px">\${emp.center}</td>\`;
        emp.weeks.forEach(w => {
          w.days.forEach(d => {
            const inPP = d.inPayPeriod; const h = d.hours;
            const cellStyle = \`text-align:center;font-family:'JetBrains Mono',monospace;font-size:10px;\${!inPP ? 'background:var(--gray-100);color:var(--gray-400);' : ''}\${h > 10 ? 'color:var(--danger);font-weight:700;' : ''}\`;
            html += \`<td style="\${cellStyle}">\${h > 0 ? h.toFixed(1) : '<span style="color:var(--gray-200)">—</span>'}</td>\`;
          });
          const wkStyle = w.overtimeHours > 0 ? 'color:var(--danger);font-weight:700' : 'font-weight:600';
          html += \`<td style="text-align:center;font-family:'JetBrains Mono',monospace;font-size:11px;background:rgba(27,42,74,0.04);\${wkStyle}">\${w.weekTotal.toFixed(1)}</td>\`;
        });
        html += \`<td style="text-align:center;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;background:var(--gold-pale)">\${emp.inPeriodHours.toFixed(1)}</td>\`;
        html += \`<td style="text-align:center;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;\${emp.totalOT > 0 ? 'color:var(--danger);background:rgba(192,57,43,0.08)' : 'color:var(--gray-300)'}">\${emp.totalOT > 0 ? '⚠️ ' + emp.totalOT.toFixed(1) : '—'}</td>\`;
        html += \`</tr>\`;
      });
      html += \`</tbody></table></div></div></div>\`;
    }
    html += \`<div style="background:var(--gold-pale);border-radius:8px;padding:12px 16px;margin-top:16px;font-size:12px;color:var(--gray-600);line-height:1.6">
      <strong>How overtime is calculated:</strong> Michigan law uses Mon–Sun work weeks. When a pay period starts or ends mid-week,
      the full week is shown (grayed-out days are from the adjacent pay period). Any week where total hours exceed 40 triggers overtime.
      The <strong>OT</strong> column shows total overtime hours across all weeks for each employee.</div>\`;
    el.innerHTML = html;
  } catch(e) { el.innerHTML = \`<div style="color:var(--danger);padding:20px">Error loading overtime view: \${e.message}</div>\`; }
}

function navOTView(dir) {
  const d = new Date(payPeriod.start + 'T12:00:00');
  d.setDate(d.getDate() + (dir * 16));
  api(\`/api/pay-period?date=\${d.toISOString().split('T')[0]}\`).then(pp => {
    payPeriod = pp;
    document.getElementById('payPeriodLabel').textContent = pp.label + ' · Pay Date: ' + new Date(pp.payDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    renderOvertimeView();
  });
}

`;

applyMod('Mod 6: New functions',
  `// ========================\n// INIT\n// ========================`,
  newFunctions + `// ========================\n// INIT\n// ========================`
);

// Write output
fs.writeFileSync(outputFile, content, 'utf8');
console.log(`\n✅ All ${modCount} modifications applied successfully!`);
console.log(`Original: ${originalLen} chars → Modified: ${content.length} chars (+${content.length - originalLen} chars)`);
console.log(`Output written to: ${outputFile}`);
console.log(`\nNext steps:`);
console.log(`1. Rename ${outputFile} to index.html`);
console.log(`2. Place in your public/ folder`);
console.log(`3. Deploy to Render with the updated server.js`);
