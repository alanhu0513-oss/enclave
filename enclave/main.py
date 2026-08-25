import sqlite3
from textual.app import App, ComposeResult
from textual.containers import Container, Vertical
from textual.screen import ModalScreen
from textual.widgets import Header, Footer, Button, Static, DataTable, Input
from textual.binding import Binding
from database import initialize_database, register_user_offline
from compliance import generate_legal_pdf

DB_PATH = "./enclave_secure_vault.db"


class ConfirmationPopup(ModalScreen):
    def __init__(self, message: str) -> None:
        super().__init__()
        self.message = message

    CSS = """
    Screen {
        align: center middle;
        background: rgba(0, 0, 0, 0.75);
    }

    #popup-container {
        width: 52;
        height: auto;
        background: #151c23;
        border: thick #00d4aa;
        padding: 2 3;
        align: center middle;
    }

    #popup-message {
        color: #e6edf3;
        text-align: center;
        margin-bottom: 2;
    }

    #popup-ok {
        width: 20;
        background: #00d4aa;
        color: #0a0e14;
        border: none;
        text-style: bold;
    }

    #popup-ok:hover {
        background: #00b894;
    }
    """

    def compose(self) -> ComposeResult:
        yield Container(
            Static(self.message, id="popup-message"),
            Button("OK", variant="primary", id="popup-ok"),
            id="popup-container",
        )

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "popup-ok":
            self.app.pop_screen()


class EnclaveApp(App):
    CSS = """
    Screen {
        background: #0a0e14;
    }

    Header {
        background: #0f1419;
        color: #00d4aa;
        text-style: bold;
        border-bottom: solid #21262d;
    }

    Footer {
        background: #0f1419;
        color: #8b949e;
        border-top: solid #21262d;
    }

    #main-container {
        layout: horizontal;
        height: 1fr;
    }

    /* ─── Sidebar ─── */
    #sidebar {
        width: 32;
        background: #0f1419;
        border-right: solid #21262d;
        padding: 1 0;
    }

    #sidebar-title {
        color: #8b949e;
        text-style: bold;
        padding: 0 2;
        margin-bottom: 1;
        text-transform: uppercase;
        letter-spacing: 1;
    }

    .sidebar-btn {
        width: 100%;
        margin: 0;
        background: #0f1419;
        color: #c9d1d9;
        border: none;
        border-left: solid #0f1419;
        padding: 1 2;
        min-height: 3;
        text-align: left;
    }

    .sidebar-btn:hover {
        background: #151c23;
        color: #e6edf3;
    }

    .sidebar-btn:focus {
        background: #151c23;
        border-left: solid #151c23;
    }

    .sidebar-btn.-active {
        background: #151c23;
        color: #00d4aa;
        border-left: solid #00d4aa;
        text-style: bold;
    }

    /* ─── Right Panel ─── */
    #right-panel {
        height: 1fr;
        padding: 1 2;
    }

    #register-view, #compliance-view, #system-view, #review-view {
        height: 100%;
    }

    /* ─── Card ─── */
    .card {
        background: #151c23;
        border: solid #21262d;
        padding: 2;
        margin-bottom: 1;
    }

    .card-title {
        color: #00d4aa;
        text-style: bold;
        margin-bottom: 1;
        border-bottom: solid #21262d;
        padding-bottom: 1;
    }

    .card-section {
        margin-top: 1;
    }

    /* ─── Form Inputs ─── */
    .input-label {
        color: #8b949e;
        margin-bottom: 0;
        margin-top: 1;
    }

    Input {
        background: #0f1419;
        color: #e6edf3;
        border: solid #21262d;
        margin-bottom: 1;
        padding: 0 1;
    }

    Input:focus {
        border: solid #00d4aa;
    }

    Input.placeholder {
        color: #484f58;
    }

    #btn-submit-register {
        margin-top: 1;
        width: 100%;
        background: #00d4aa;
        color: #0a0e14;
        border: none;
        text-style: bold;
    }

    #btn-submit-register:hover {
        background: #00b894;
    }

    /* ─── Buttons ─── */
    Button {
        background: #21262d;
        color: #c9d1d9;
        border: solid #30363d;
        text-style: bold;
        min-height: 3;
    }

    Button:hover {
        background: #30363d;
    }

    Button:focus {
        border: solid #58a6ff;
    }

    Button.-primary {
        background: #00d4aa;
        color: #0a0e14;
        border: none;
    }

    Button.-primary:hover {
        background: #00b894;
    }

    Button.-error {
        background: #f85149;
        color: #ffffff;
        border: none;
    }

    Button.-error:hover {
        background: #da3633;
    }

    Button.-warning {
        background: #d29922;
        color: #0a0e14;
        border: none;
    }

    Button.-warning:hover {
        background: #bb7d1a;
    }

    /* ─── Stats Bar ─── */
    #stats-bar {
        layout: horizontal;
        height: auto;
        margin-bottom: 1;
    }

    .stat-card {
        width: 1fr;
        background: #151c23;
        border: solid #21262d;
        padding: 1;
        margin: 0 1 0 0;
    }

    .stat-card:last-child {
        margin-right: 0;
    }

    .stat-value {
        color: #e6edf3;
        text-style: bold;
        text-align: center;
    }

    .stat-label {
        color: #8b949e;
        text-align: center;
    }

    .stat-card.-accent {
        border: solid #00d4aa;
    }

    .stat-card.-accent .stat-value {
        color: #00d4aa;
    }

    /* ─── Data Table ─── */
    DataTable {
        background: #0f1419;
        color: #c9d1d9;
        height: 1fr;
    }

    DataTable > .datatable--header {
        background: #151c23;
        color: #00d4aa;
        text-style: bold;
    }

    DataTable > .datatable--cursor {
        background: #1f2937;
    }

    DataTable > .datatable--hover {
        background: #1f2937;
    }

    /* ─── Review Panel ─── */
    #review-header {
        color: #e6edf3;
        text-style: bold;
        margin-bottom: 1;
        border-bottom: solid #21262d;
        padding-bottom: 1;
    }

    #review-body {
        layout: horizontal;
        height: 1fr;
    }

    .review-pane {
        width: 1fr;
        background: #151c23;
        border: solid #21262d;
        padding: 1 2;
        margin: 0 1 0 0;
    }

    .review-pane:last-child {
        margin-right: 0;
    }

    .pane-title {
        color: #00d4aa;
        text-style: bold;
        margin-bottom: 1;
        padding-bottom: 1;
        border-bottom: solid #21262d;
    }

    .pane-content {
        color: #e6edf3;
    }

    .pane-content .dim {
        color: #8b949e;
    }

    #review-actions {
        layout: horizontal;
        height: 5;
        align: center middle;
        margin-top: 1;
        padding-top: 1;
        border-top: solid #21262d;
    }

    .action-btn {
        margin: 0 1;
        min-width: 24;
    }

    /* ─── System View ─── */
    #system-info {
        color: #e6edf3;
        margin-bottom: 1;
    }

    .sys-row {
        margin-bottom: 0;
    }

    .dim {
        color: #8b949e;
    }

    .accent {
        color: #00d4aa;
    }

    #register-status, #compliance-status, #system-status {
        color: #8b949e;
        margin-top: 1;
    }
    """

    BINDINGS = [
        Binding("q", "quit", "Quit"),
        Binding("1", "show_register", "Register", show=False),
        Binding("2", "show_compliance", "Alerts", show=False),
        Binding("3", "show_system", "Config", show=False),
    ]

    def __init__(self) -> None:
        super().__init__()
        initialize_database()
        self._seed_sample_alerts()
        self.current_alert_id: int | None = None
        self.current_alert_source: str | None = None

    def compose(self) -> ComposeResult:
        yield Header(show_clock=True)
        with Container(id="main-container"):
            with Vertical(id="sidebar"):
                yield Static("Controls", id="sidebar-title")
                yield Button(" 1  Register Profile", id="btn-register", classes="sidebar-btn")
                yield Button(" 2  Compliance Monitor", id="btn-compliance", classes="sidebar-btn")
                yield Button(" 3  System Configuration", id="btn-system", classes="sidebar-btn")
            with Container(id="right-panel"):
                with Container(id="register-view"):
                    with Container(classes="card"):
                        yield Static("Register New Biometric Profile", classes="card-title")
                        yield Static("Username", classes="input-label")
                        yield Input(placeholder="Enter unique username...", id="input-username")
                        yield Static("Local Image Path", classes="input-label")
                        yield Input(placeholder="e.g. /Users/name/photo.jpg", id="input-image-path")
                        yield Button("Submit Biometrics", id="btn-submit-register")
                        yield Static("", id="register-status")
                with Container(id="compliance-view"):
                    with Container(id="stats-bar"):
                        yield Container(
                            Static("0", id="stat-total", classes="stat-value"),
                            Static("Total Alerts", classes="stat-label"),
                            classes="stat-card -accent",
                        )
                        yield Container(
                            Static("0", id="stat-pending", classes="stat-value"),
                            Static("Pending Review", classes="stat-label"),
                            classes="stat-card",
                        )
                        yield Container(
                            Static("0", id="stat-resolved", classes="stat-value"),
                            Static("Resolved", classes="stat-label"),
                            classes="stat-card",
                        )
                    with Container(classes="card"):
                        yield Static("Identity Alerts", classes="card-title")
                        yield DataTable(id="alerts-table")
                    yield Static("", id="compliance-status")
                with Container(id="system-view"):
                    with Container(classes="card"):
                        yield Static("Enclave System Configuration", classes="card-title")
                        yield Static("", id="system-info")
                with Container(id="review-view"):
                    yield Static("", id="review-header")
                    with Container(id="review-body"):
                        with Container(classes="review-pane"):
                            yield Static("Profile Parameters", classes="pane-title")
                            yield Static("", id="review-profile-content", classes="pane-content")
                        with Container(classes="review-pane"):
                            yield Static("Infringement Details", classes="pane-title")
                            yield Static("", id="review-alert-content", classes="pane-content")
                    with Container(id="review-actions"):
                        yield Button("Ignore / Whitelist", id="btn-whitelist", classes="action-btn", variant="error")
                        yield Button("Issue DMCA Notice", id="btn-dmca", classes="action-btn", variant="primary")
                        yield Button("Issue Cease & Desist", id="btn-cnd", classes="action-btn", variant="warning")
        yield Footer()

    def _seed_sample_alerts(self) -> None:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM identity_alerts")
        if cursor.fetchone()[0] == 0:
            sample_alerts = [
                ("https://socialmedia-clone.xyz", 94.2),
                ("https://deepfake-forum.net", 88.7),
            ]
            cursor.executemany(
                "INSERT INTO identity_alerts (infringing_source, match_confidence) VALUES (?, ?)",
                sample_alerts,
            )
            conn.commit()
        conn.close()

    def _refresh_alerts(self) -> None:
        table = self.query_one("#alerts-table", DataTable)
        table.clear()
        table.add_columns("ID", "Source", "Confidence", "Status")

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT id, infringing_source, match_confidence, status FROM identity_alerts WHERE status = 'PENDING_REVIEW'")
        alerts = cursor.fetchall()
        cursor.execute("SELECT COUNT(*) FROM identity_alerts")
        total = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM identity_alerts WHERE status = 'PENDING_REVIEW'")
        pending = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM identity_alerts WHERE status != 'PENDING_REVIEW'")
        resolved = cursor.fetchone()[0]
        conn.close()

        self.query_one("#stat-total", Static).update(str(total))
        self.query_one("#stat-pending", Static).update(str(pending))
        self.query_one("#stat-resolved", Static).update(str(resolved))

        for row in alerts:
            table.add_row(str(row[0]), row[1], f"{row[2]}%", row[3], key=str(row[0]))

        status = self.query_one("#compliance-status", Static)
        if not alerts:
            status.update("[dim]System Stable: No pending identity alerts.[/dim]")
        else:
            status.update(f"[bold #d29922]{len(alerts)}[/bold #d29922] [dim]pending alert(s) awaiting review. Click a row to inspect.[/dim]")

    def _refresh_system_info(self) -> None:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM users")
        users_count = cursor.fetchone()[0]
        conn.close()

        info = (
            f"Version:  [accent]1.0.0-Beta[/accent]\n"
            f"Architecture:  [dim]Offline Zero-Knowledge Secure Enclave[/dim]\n"
            f"Database:  [dim]SQLite Local Vault[/dim]\n"
            f"Registered Profiles:  [accent]{users_count}[/accent]\n"
            f"Biometric Engine:  [dim]OpenCV Haar Cascade (Local)[/dim]\n"
            f"PDF Engine:  [dim]ReportLab (Local Generation)[/dim]\n"
            f"Status:  [accent]All Systems Operational (Offline)[/accent]"
        )
        self.query_one("#system-info", Static).update(info)

    def _show_view(self, view_id: str) -> None:
        for vid in ["register-view", "compliance-view", "system-view", "review-view"]:
            self.query_one(f"#{vid}").display = False
        self.query_one(f"#{view_id}").display = True

    def _sidebar_reset(self) -> None:
        for bid in ["btn-register", "btn-compliance", "btn-system"]:
            self.query_one(f"#{bid}").classes = "sidebar-btn"

    def _sidebar_activate(self, btn_id: str) -> None:
        self._sidebar_reset()
        self.query_one(f"#{btn_id}").classes = "sidebar-btn -active"

    def _return_to_compliance(self) -> None:
        self._sidebar_activate("btn-compliance")
        self._show_view("compliance-view")
        self._refresh_alerts()

    def on_mount(self) -> None:
        self._sidebar_activate("btn-register")
        self._show_view("register-view")
        self._refresh_alerts()

    def on_data_table_row_selected(self, event: DataTable.RowSelected) -> None:
        alert_id = int(str(event.row_key.value))
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, infringing_source, match_confidence, status FROM identity_alerts WHERE id = ?",
            (alert_id,),
        )
        alert = cursor.fetchone()
        conn.close()
        if not alert:
            return

        self.current_alert_id = alert[0]
        self.current_alert_source = alert[1]

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT username, sample_image_path FROM users LIMIT 1")
        user = cursor.fetchone()
        conn.close()

        profile_lines = []
        profile_lines.append("[accent]Registered User[/accent]")
        profile_lines.append("───" * 8)
        if user:
            profile_lines.append(f"")
            profile_lines.append(f"[bold]Username:[/bold]  {user[0]}")
            profile_lines.append(f"[bold]Image Path:[/bold]  [dim]{user[1]}[/dim]")
        else:
            profile_lines.append(f"")
            profile_lines.append("[dim]No profile registered yet.[/dim]")
            profile_lines.append("[dim]Use 'Register Profile' to add one.[/dim]")
        self.query_one("#review-profile-content", Static).update("\n".join(profile_lines))

        alert_lines = []
        alert_lines.append("[#f85149]Infringing URL[/#f85149]")
        alert_lines.append("───" * 8)
        alert_lines.append(f"")
        alert_lines.append(f"{alert[1]}")
        alert_lines.append(f"")
        alert_lines.append(f"[bold]Match Confidence:[/bold]  [#d29922]{alert[2]}%[/#d29922]")
        alert_lines.append(f"[bold]Status:[/bold]  {alert[3]}")
        self.query_one("#review-alert-content", Static).update("\n".join(alert_lines))
        self.query_one("#review-header", Static).update(f"Incident Review — Alert #{alert[0]}")
        self._show_view("review-view")

    def action_show_register(self) -> None:
        self._sidebar_activate("btn-register")
        self._show_view("register-view")

    def action_show_compliance(self) -> None:
        self._return_to_compliance()

    def action_show_system(self) -> None:
        self._sidebar_activate("btn-system")
        self._show_view("system-view")
        self._refresh_system_info()

    def on_button_pressed(self, event: Button.Pressed) -> None:
        btn = event.button
        btn_id = btn.id

        if btn_id == "btn-register":
            self.action_show_register()
        elif btn_id == "btn-compliance":
            self.action_show_compliance()
        elif btn_id == "btn-system":
            self.action_show_system()
        elif btn_id == "btn-submit-register":
            username = self.query_one("#input-username", Input).value.strip()
            img_path = self.query_one("#input-image-path", Input).value.strip()
            if not username or not img_path:
                self.push_screen(ConfirmationPopup("Please fill in all fields before submitting."))
                return
            result = register_user_offline(username, img_path)
            self.push_screen(ConfirmationPopup(result))
        elif btn_id == "btn-whitelist" and self.current_alert_id is not None:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE identity_alerts SET status = 'WHITELISTED' WHERE id = ?",
                (self.current_alert_id,),
            )
            conn.commit()
            conn.close()
            self.push_screen(ConfirmationPopup("Alert whitelisted successfully."))
            self._return_to_compliance()
        elif btn_id == "btn-dmca" and self.current_alert_id is not None:
            self._generate_notice("DMCA")
        elif btn_id == "btn-cnd" and self.current_alert_id is not None:
            self._generate_notice("CEASE_AND_DESIST")

    def _generate_notice(self, doc_type: str) -> None:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT username FROM users LIMIT 1")
        result = cursor.fetchone()
        conn.close()
        user_name = result[0] if result else "Enclave Secure User Account"
        doc_label = "dmca" if doc_type == "DMCA" else "cease_and_desist"
        output_file = f"enclave_incident_{self.current_alert_id}_{doc_label}.pdf"
        msg = generate_legal_pdf(doc_type, user_name, self.current_alert_source, output_file)

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE identity_alerts SET status = 'NOTICE_GENERATED' WHERE id = ?",
            (self.current_alert_id,),
        )
        conn.commit()
        conn.close()

        self.push_screen(ConfirmationPopup("PDF Notice Successfully Generated Locally!"))
        self._return_to_compliance()


if __name__ == "__main__":
    app = EnclaveApp()
    app.run()
