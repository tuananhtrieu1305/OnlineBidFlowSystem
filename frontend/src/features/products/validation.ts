export type Fields = { name: string; description: string; quantity: string; estimatedPrice: string };
export function validateProduct(fields: Fields): Partial<Record<keyof Fields,string>> {
 const errors: Partial<Record<keyof Fields,string>> = {};
 if(!fields.name.trim()||[...fields.name.trim()].length>255) errors.name='Nhập tên sản phẩm từ 1 đến 255 ký tự.';
 if([...fields.description.trim()].length>5000) errors.description='Mô tả tối đa 5.000 ký tự.';
 if(!/^[1-9][0-9]{0,9}$/.test(fields.quantity)||BigInt(fields.quantity)>2147483647n) errors.quantity='Số lượng phải là số nguyên từ 1 đến 2.147.483.647.';
 if(fields.estimatedPrice&&(!/^[1-9][0-9]{0,18}$/.test(fields.estimatedPrice)||BigInt(fields.estimatedPrice)>9223372036854775807n)) errors.estimatedPrice='Giá phải là số Coin nguyên dương trong giới hạn cho phép.';
 return errors;
}
