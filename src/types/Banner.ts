/** Source: math-svr internal/application/dto/banner/banner_dto.go (BannerResponse). */

export type BannerMediaType = 'TEXT' | 'IMAGE' | 'VIDEO'

export type BannerStatus = 'ACTIVE' | 'INACTIVE' | 'DELETED'

export type Banner = {
  banner_id: number
  title?: string
  short_text?: string
  media_type: BannerMediaType
  media_url_key: string
  /** Presigned and short-lived — display it, don't store it. */
  media_url: string | null
  button_text?: string
  button_link_url?: string
  note?: string
  banner_status?: BannerStatus
  create_dt: string
  modify_dt: string
}
