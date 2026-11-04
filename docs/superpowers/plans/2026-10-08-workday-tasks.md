# Approved workday actions and tasks panel

Use cookie button styling for the three workday actions: 44px minimum height, 12px radius, 13px font and600 weight. Rental is primary blue; booking/tasks use surface color. Mobile wraps the third action rather than compressing labels.

Add Tasks client trigger wrapping server-rendered existing TaskComposer and WorkdayBoard manual tasks. Accessible existing Modal boundary: desktop right panel, mobile bottom sheet, scrollable, close/Escape/backdrop. Preserve existing all-events disclosure. No database or action behavior changes, notes remain task comments.

Test opening/closing and children; typecheck and scoped dashboard tests. Deploy only scoped files in retained-release workflow; verify mobile and desktop live. No commits/merges or real task creation during verification.
