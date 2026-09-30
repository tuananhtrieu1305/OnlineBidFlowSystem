export type RegistrationFields = { username: string; password: string; confirmPassword: string };
export type FieldErrors = Partial<Record<keyof RegistrationFields, string>>;

export function validateRegistration(values: RegistrationFields): FieldErrors {
  const errors: FieldErrors = {};
  const username = values.username.trim().toLowerCase();
  if (username.length < 3 || username.length > 50) errors.username = 'Tên đăng nhập cần từ 3 đến 50 ký tự.';
  else if (!/^[a-z0-9._-]+$/.test(username)) errors.username = 'Chỉ dùng chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang.';
  if ([...values.password].length < 12) errors.password = 'Mật khẩu cần ít nhất 12 ký tự.';
  else if (new TextEncoder().encode(values.password).length > 72 || values.password.includes('\0')) {
    errors.password = 'Mật khẩu quá dài hoặc chứa ký tự không hợp lệ. Hãy dùng một cụm từ khác.';
  }
  if (!values.confirmPassword || values.confirmPassword !== values.password) errors.confirmPassword = 'Mật khẩu xác nhận chưa khớp.';
  return errors;
}
