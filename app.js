const projectRef = 'bbcmzzjicuhlmulvcpgu';
const viewInfo = {
  overview:['Workspace overview','YOUR AGENCY AT A GLANCE','A clear view of your team’s work, reviews, and upcoming deadlines.'],
  projects:['Projects','DELIVER THE WORK','Keep projects, owners, deliverables, and deadlines together.'],
  reviews:['Review centre','REVIEW & FEEDBACK','One place for submissions from every service line.'],
  team:['Team members','PEOPLE & PERMISSIONS','Membership and workload, governed by verified roles.'],
  clients:['Clients','RELATIONSHIPS','Client records and approval status in one place.'],
  services:['Services','SERVICE LINES','Ten service workspaces, ready to map to verified project records.'],
  tasks:['Tasks','WORKLOAD','Assignments, priorities, and due dates linked to their source projects.'],
  calendar:['Calendar','PLAN AHEAD','Deadlines and milestones from the same underlying projects and tasks.'],
  templates:['Project templates','REPEAT WHAT WORKS','Reusable project structures and recurring work definitions.'],
  reports:['Reports','SIGNALS THAT MATTER','Team and business reporting based on authorized records.'],
  activity:['Activity log','ACCOUNTABILITY','A traceable history of authorized workspace actions.'],
  settings:['Settings','WORKSPACE CONTROL','Connection details for the selected Supabase project.']
};
const services = [
  ['Website Design & Development','Websites, landing pages, and responsive digital experiences.','⌘'],
  ['SEO','Search visibility, content structure, and optimization work.','⌕'],
  ['Social Media Marketing','Social content, campaign planning, and channel activity.','◎'],
  ['Google Ads','Search and display campaigns with clear review stages.','↗'],
  ['Meta Ads','Facebook and Instagram campaign deliverables.','◉'],
  ['Content Marketing','Editorial, website, and campaign content projects.','≋'],
  ['Graphic Design','Creative assets, brand visuals, and design deliverables.','▧'],
  ['Email Marketing','Email campaigns, newsletters, and automation projects.','✉'],
  ['Branding','Identity systems and brand communication projects.','✳'],
  ['E-commerce Marketing','Online store campaigns and conversion improvements.','▣']
];
const content = document.querySelector('#main-content');
const sidebar = document.querySelector('#sidebar');
const scrim = document.querySelector('#mobile-scrim');
const connectionDialog = document.querySelector('#connection-dialog');
let currentView = 'overview';
let displayedMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

function stat(label, icon, color) {
  return '<article class="stat-card"><div class="stat-top"><span class="stat-icon ' + color + '">' + icon + '</span><span class="stat-label">' + label + '</span><span class="stat-menu">···</span></div><div class="stat-value">—</div><div class="stat-foot">Awaiting verified data</div></article>';
}
function emptyCard(icon, title, copy, compact) {
  return '<div class="empty-card' + (compact ? ' compact-empty' : '') + '"><span class="empty-illustration">' + icon + '</span><strong>' + title + '</strong><p>' + copy + '</p></div>';
}
function heading(title, kicker, description, action) {
  return '<div class="page-heading"><div><p class="eyebrow"><span class="eyebrow-dot"></span>' + kicker + '</p><h1>' + title + '</h1><p class="page-description">' + description + '</p></div>' + (action || '') + '</div>';
}
function actionDisabled(label, title) {
  return '<button class="button button-disabled" type="button" disabled title="' + title + '">' + label + '</button>';
}
function tabs(names) {
  return '<div class="filter-tabs">' + names.map(function (name, index) {
    return '<button class="filter-tab' + (index === 0 ? ' is-selected' : '') + '" type="button">' + name + '</button>';
  }).join('') + '</div>';
}
function renderOverview() {
  return heading('Workspace overview',viewInfo.overview[1],viewInfo.overview[2],'<div class="heading-actions"><span class="date-chip"><span>◷</span><span id="today-label"></span></span><button class="button button-primary" data-open-connection>Check connection <b>↗</b></button></div>') +
    '<div class="connection-alert" role="status"><div class="alert-icon">!</div><div class="alert-copy"><strong>Live workspace data is unavailable</strong><p>Project read access is verified for <code>' + projectRef + '</code>. No dashboard tables or verified backup exist yet, so workflow metrics stay empty and migrations remain paused.</p></div><button class="alert-link" data-open-connection>View details <span>↗</span></button></div>' +
    '<div class="stat-grid" aria-label="Workspace statistics unavailable">' + stat('ACTIVE PROJECTS','▤','stat-green') + stat('PENDING REVIEWS','◉','stat-amber') + stat('ACTIVE TEAM','♧','stat-blue') + stat('UPCOMING DEADLINES','◷','stat-red') + '</div>' +
    '<div class="overview-grid"><section class="panel project-health-panel"><div class="panel-heading"><div><p class="panel-kicker">WORK IN MOTION</p><h2>Project health</h2></div><button class="text-button" data-view="projects">View projects <span>↗</span></button></div><div class="chart-blank"><div class="chart-grid-lines"><i></i><i></i><i></i><i></i></div><div class="chart-lock">↗</div><strong>Project activity will appear here</strong><p>Connect to verified project records to see progress over time.</p></div><div class="chart-legend"><span><i class="legend-dot legend-dot-green"></i> In progress</span><span><i class="legend-dot legend-dot-dim"></i> Completed</span><span class="chart-note">No data loaded</span></div></section>' +
    '<section class="panel review-panel"><div class="panel-heading"><div><p class="panel-kicker">NEEDS ATTENTION</p><h2>Review queue</h2></div><button class="icon-button subtle-button" data-view="reviews" aria-label="Open review centre">↗</button></div>' + emptyCard('◉','Nothing to review yet','Submissions will appear when verified project data is connected.',true) + '<button class="button button-secondary full-width" data-view="reviews">Open review centre <span>↗</span></button></section></div>' +
    '<div class="overview-grid overview-grid-lower"><section class="panel recent-panel"><div class="panel-heading"><div><p class="panel-kicker">LATEST WORK</p><h2>Recent projects</h2></div><button class="text-button" data-view="projects">All projects <span>↗</span></button></div>' + emptyCard('▤','Projects will show up here','Project names and statuses will load from your connected workspace.') + '</section><section class="panel deadlines-panel"><div class="panel-heading"><div><p class="panel-kicker">KEEP THINGS MOVING</p><h2>Coming up</h2></div><button class="icon-button subtle-button" data-view="calendar" aria-label="Open calendar">↗</button></div>' + emptyCard('◷','No deadlines loaded','Upcoming work appears after project and task access is verified.',true) + '<button class="text-button deadline-calendar-link" data-view="calendar">Open calendar <span>↗</span></button></section></div>';
}
function renderServiceCards() {
  return '<div class="service-grid">' + services.map(function (service, index) {
    return '<article class="service-card" style="animation-delay:' + (index * 0.025) + 's"><span class="service-index">' + String(index + 1).padStart(2,'0') + '</span><span class="service-icon">' + service[2] + '</span><h2>' + service[0] + '</h2><p>' + service[1] + '</p><span class="service-status">AWAITING DATA</span></article>';
  }).join('') + '</div>';
}
function renderCalendar() {
  return heading('Calendar',viewInfo.calendar[1],viewInfo.calendar[2],actionDisabled('＋ Add event','Calendar events require verified records')) +
    '<section class="panel calendar-panel"><div class="calendar-heading"><div><p class="panel-kicker">MONTH VIEW</p><h2 id="calendar-month"></h2></div><div class="calendar-controls"><button class="button button-secondary" id="calendar-today">Today</button><button class="icon-button subtle-button" id="calendar-prev" aria-label="Previous month">‹</button><button class="icon-button subtle-button" id="calendar-next" aria-label="Next month">›</button></div></div><div class="calendar-grid" id="calendar-grid" aria-label="Calendar month"></div><p class="calendar-note"><span class="connection-dot"></span>No events loaded — live deadlines are hidden until connection and schema access are verified.</p></section>';
}
function genericPage(key) {
  const info = viewInfo[key];
  let action = '';
  let body = '';
  if (key === 'projects') {
    action = actionDisabled('＋ New project','Unavailable until project schema and permissions can be inspected');
    body = '<div class="toolbar panel">' + tabs(['All projects','In progress','In review','Completed']) + actionDisabled('Filter ☷','Project records are not loaded') + '</div><div class="panel data-empty">' + emptyCard('▤','Project records are not available','Once read access is restored, projects will load here without creating duplicate records.') + '</div>';
  } else if (key === 'reviews') {
    action = actionDisabled('Review settings ⚙','Review actions require verified records and permissions');
    body = '<div class="stat-grid stat-grid-small">' + stat('PENDING','◉','stat-amber') + stat('APPROVED','✓','stat-green') + stat('CHANGES REQUESTED','↻','stat-blue') + stat('TOTAL SUBMISSIONS','▤','stat-red') + '</div><div class="toolbar panel">' + tabs(['All reviews','Pending','Changes requested','Approved']) + actionDisabled('All services⌄','Service records are not loaded') + '</div><div class="panel data-empty">' + emptyCard('◉','The review queue is empty','Review records will remain untouched until project access, schema, and permissions can be verified.') + '</div>';
  } else if (key === 'team') {
    action = actionDisabled('＋ Invite member','Team actions require verified authentication and RLS policies');
    body = '<div class="stat-grid stat-grid-small">' + stat('TOTAL MEMBERS','♧','stat-blue') + stat('ACTIVE','●','stat-green') + stat('INACTIVE','◌','stat-amber') + stat('PENDING REQUESTS','◷','stat-red') + '</div><section class="panel table-panel"><div class="panel-heading"><div><p class="panel-kicker">DIRECTORY</p><h2>All team members</h2></div>' + actionDisabled('Filter ☷','Member records are not loaded') + '</div><div class="table-empty-state"><strong>Team records are not loaded</strong><span>Member identities and roles remain hidden until authentication and access policies are inspected.</span></div></section>';
  } else if (key === 'services') {
    action = actionDisabled('Manage services ⚙','Service management is paused until schema inspection');
    body = renderServiceCards();
  } else if (key === 'calendar') {
    body = renderCalendar();
  } else if (key === 'settings') {
    body = '<div class="settings-grid"><section class="panel settings-card"><div class="panel-heading"><div><p class="panel-kicker">SUPABASE CONNECTION</p><h2>Selected project</h2></div><span class="status-chip status-chip-error">SCHEMA PENDING</span></div><dl class="connection-details"><div><dt>Project reference</dt><dd><code>' + projectRef + '</code></dd></div><div><dt>Read check</dt><dd>Verified read-only</dd></div><div><dt>Project status</dt><dd>ACTIVE_HEALTHY</dd></div><div><dt>Backup status</dt><dd>None · Free plan</dd></div><div><dt>Database changes</dt><dd>None made</dd></div></dl><button class="button button-secondary" data-open-connection>Connection help <span>↗</span></button></section><section class="panel settings-card"><div class="panel-heading"><div><p class="panel-kicker">DATA PROTECTION</p><h2>Safe mode</h2></div><span class="status-chip status-chip-green">ON</span></div><p class="settings-copy">Dashboard records are unavailable because workflow tables do not exist. No verified backup is available, so migrations are paused; existing enquiries remain protected by RLS.</p><ul class="safe-list"><li>Existing website left unchanged</li><li>No existing records modified</li><li>Only the selected project used</li><li>No verified backup is available</li><li>No sample statistics or test records</li></ul></section></div>';
  } else {
    const icon = {clients:'◇',tasks:'☷',templates:'▧',reports:'⌁',activity:'⌁'}[key] || '◌';
    const title = {clients:'Client records have not been loaded',tasks:'No tasks loaded',templates:'No templates loaded',reports:'Reports are waiting for live data',activity:'No activity loaded'}[key] || 'No records loaded';
    const copy = {clients:'Existing client data will be mapped after the selected project’s schema and access rules can be read.',tasks:'Tasks will appear after the current database structure and member permissions are reviewed.',templates:'Templates and recurrence rules will not be created until existing tables, policies, and scheduling options are inspected.',reports:'No illustrative statistics are shown. Reports will be built from records you authorize.',activity:'Activity records will be read only after the project and audit schema can be inspected.'}[key] || 'Records will appear after access is verified.';
    if (key === 'clients') action = actionDisabled('＋ Add client','Client records are not connected');
    if (key === 'tasks') action = actionDisabled('＋ New task','Task creation requires verified schema and permissions');
    if (key === 'templates') action = actionDisabled('＋ New template','Template writes are paused until database access is verified');
    if (key === 'reports') action = actionDisabled('Export report ↓','Exports require verified data and authorization');
    if (key === 'activity') action = actionDisabled('Filter activity ☷','Activity records are not loaded');
    body = '<div class="panel data-empty">' + emptyCard(icon,title,copy) + '</div>';
  }
  return heading(info[0],info[1],info[2],action) + body;
}
function renderCalendarGrid() {
  const grid = document.querySelector('#calendar-grid');
  const label = document.querySelector('#calendar-month');
  if (!grid || !label) return;
  label.textContent = new Intl.DateTimeFormat('en',{month:'long',year:'numeric'}).format(displayedMonth);
  const days = ['MON','TUE','WED','THU','FRI','SAT','SUN'];
  const first = new Date(displayedMonth.getFullYear(),displayedMonth.getMonth(),1);
  const startOffset = (first.getDay() + 6) % 7;
  const today = new Date();
  let cells = days.map(function(day){ return '<div class="calendar-day-name">' + day + '</div>'; }).join('');
  for (let index=0; index<42; index++) {
    const date = new Date(displayedMonth.getFullYear(),displayedMonth.getMonth(),1 - startOffset + index);
    const outside = date.getMonth() !== displayedMonth.getMonth();
    const isToday = date.toDateString() === today.toDateString();
    cells += '<div class="calendar-day' + (outside ? ' is-outside' : '') + (isToday ? ' is-today' : '') + '"><span>' + date.getDate() + '</span></div>';
  }
  grid.innerHTML = cells;
}
function render(view) {
  currentView = viewInfo[view] ? view : 'overview';
  const info = viewInfo[currentView];
  document.title = info[0] + ' · Rank Right Workspace';
  document.querySelector('#breadcrumb-current').textContent = info[0];
  document.querySelectorAll('[data-view]').forEach(function(button) {
    button.classList.toggle('is-active', button.dataset.view === currentView);
    if (button.classList.contains('nav-item')) {
      if (button.dataset.view === currentView) button.setAttribute('aria-current','page');
      else button.removeAttribute('aria-current');
    }
  });
  content.innerHTML = '<section class="view-panel is-visible">' + (currentView === 'overview' ? renderOverview() : genericPage(currentView)) + '</section>';
  if (currentView === 'calendar') renderCalendarGrid();
  const date = document.querySelector('#today-label');
  if (date) date.textContent = new Intl.DateTimeFormat('en',{weekday:'short',month:'short',day:'numeric'}).format(new Date());
}
document.addEventListener('click',function(event) {
  const viewButton = event.target.closest('[data-view]');
  if (viewButton) {
    event.preventDefault();
    render(viewButton.dataset.view);
    sidebar.classList.remove('is-open');scrim.classList.remove('is-visible');
    document.querySelector('#menu-toggle').setAttribute('aria-expanded','false');
  }
  if (event.target.closest('[data-open-connection]') && !connectionDialog.open) connectionDialog.showModal();
  if (event.target.closest('[data-close-dialog]')) connectionDialog.close();
  const tab = event.target.closest('.filter-tab');
  if (tab) {
    tab.parentElement.querySelectorAll('.filter-tab').forEach(function(item){item.classList.toggle('is-selected',item===tab);});
  }
  const note = event.target.closest('#notification-button');
  if (note) {
    const popover = document.querySelector('#notification-note');
    popover.hidden = !popover.hidden;
  } else if (!event.target.closest('#notification-note')) document.querySelector('#notification-note').hidden = true;
});
document.querySelector('#menu-toggle').addEventListener('click',function(){
  const opened = sidebar.classList.toggle('is-open');
  scrim.classList.toggle('is-visible',opened);
  this.setAttribute('aria-expanded',String(opened));
});
scrim.addEventListener('click',function(){sidebar.classList.remove('is-open');scrim.classList.remove('is-visible');document.querySelector('#menu-toggle').setAttribute('aria-expanded','false');});
document.addEventListener('click',function(event){
  if(event.target.closest('#calendar-prev')){displayedMonth.setMonth(displayedMonth.getMonth()-1);renderCalendarGrid();}
  if(event.target.closest('#calendar-next')){displayedMonth.setMonth(displayedMonth.getMonth()+1);renderCalendarGrid();}
  if(event.target.closest('#calendar-today')){const now=new Date();displayedMonth=new Date(now.getFullYear(),now.getMonth(),1);renderCalendarGrid();}
});
const searchInput=document.querySelector('#workspace-search');
searchInput.addEventListener('input',function(){document.querySelector('#search-note').hidden=!this.value.trim();});
searchInput.addEventListener('focus',function(){if(this.value.trim())document.querySelector('#search-note').hidden=false;});
document.addEventListener('keydown',function(event){
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();searchInput.focus();}
  if(event.key==='Escape'){document.querySelector('#search-note').hidden=true;document.querySelector('#notification-note').hidden=true;}
});
render('overview');



