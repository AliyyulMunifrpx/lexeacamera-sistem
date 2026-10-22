endpoint get /cameras
harus login dulu karena ini buat admin,
reqnya query: pencarian nama, min price, max price, category, page, condition
resnya :{ data: [
{
id: '65d3fdba-6340-4756-8d5e-bde435488927',
name: 'Canon EOS R50 t1792485920146',
price: 12000000,
stock: 1,
images: [],
category: [Object]
},
{
id: '30335b1f-5361-4399-9eff-d424898425da',
name: 'Nikon D3500 t1792485920146',
price: 7000000,
stock: 1,
images: [],
category: [Object]
},
{
id: 'a56aa87a-016f-47b4-b8ff-b1afbb4671ef',
name: 'Canon EOS 1500D t1792485920146',
price: 5000000,
stock: 1,
images: [],
category: [Object]
}
],
paging: { page: 1, per_page: 20, total: 3, total_pages: 1 }}
