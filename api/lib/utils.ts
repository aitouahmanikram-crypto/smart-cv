export function serializeUserBio(role: string, status: string, realBio: string) {
  return "__VIRTUAL_USER_DATA__:" + JSON.stringify({
    role,
    status,
    real_bio: realBio
  });
}

export function extendUserWithVirtualFields(user: any) {
  if (!user) return null;
  
  let role = "user";
  let status = "active";
  let bio = user.bio || "";
  
  if (user.email === "admin@smartcvai.com") {
    role = "super_admin";
  }
  
  if (user.bio && typeof user.bio === "string" && user.bio.startsWith("__VIRTUAL_USER_DATA__:")) {
    try {
      const jsonStr = user.bio.slice("__VIRTUAL_USER_DATA__:".length);
      const parsed = JSON.parse(jsonStr);
      if (parsed && typeof parsed === "object") {
        role = parsed.role || role;
        status = parsed.status || status;
        bio = parsed.real_bio !== undefined ? parsed.real_bio : "";
      }
    } catch (e) {}
  }
  
  return {
    ...user,
    role,
    status,
    bio
  };
}
