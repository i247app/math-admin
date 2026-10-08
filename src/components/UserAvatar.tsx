import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { User } from '@/types/User'
import { cn, initialsOf } from '@/utils/Helpers'

/** Round avatar: the uploaded picture, or the name's initials. */
export function UserAvatar({
  user,
  name,
  className,
  fallbackClassName,
}: {
  user: User
  name: string
  className?: string
  fallbackClassName?: string
}) {
  return (
    <Avatar className={cn('size-9', className)}>
      {user.avatar_url && <AvatarImage src={user.avatar_url} alt="" />}
      <AvatarFallback className={cn('bg-secondary text-[13px] font-bold text-primary', fallbackClassName)}>
        {initialsOf(name)}
      </AvatarFallback>
    </Avatar>
  )
}
