export function validateAmount(value: string): string | null {
  if (!/^[1-9][0-9]{0,18}$/.test(value) || BigInt(value) > 9223372036854775807n)
    return 'Nhập số Coin nguyên dương hợp lệ.';
  return null;
}
export function formatCoin(value: string): string {
  return new Intl.NumberFormat('vi-VN').format(BigInt(value));
}
