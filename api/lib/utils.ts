export function serializeUserBio(role: string, status: string, realBio: string) {
  return "__VIRTUAL_USER_DATA__:" + JSON.stringify({
    role,
    status,
    real_bio: realBio
  });
}
