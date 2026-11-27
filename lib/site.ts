const host=process.env.VERCEL_URL
export const siteUrl=process.env.NEXT_PUBLIC_SITE_URL??(host?`https://${host}`:'http://localhost:3000')
