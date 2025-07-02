export class Permissions {
  static donations = {
    viewSummary: { contentType: "Donations", action: "View Summary" },
    edit: { contentType: "Donations", action: "Edit" },
    view: { contentType: "Donations", action: "View" }
  };
  static settings = {
    edit: { contentType: "Settings", action: "Edit" },
    view: { contentType: "Settings", action: "View" }
  };
}
