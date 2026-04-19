import { NavLink } from 'react-router-dom';

import type { NavItem } from '@/features/navigation/navigation';

export type SideNavProps = {
  items: NavItem[];
};

export function SideNav({ items }: SideNavProps) {
  return (
    <aside className="side-nav" aria-label="Primary navigation">
      <ul>
        {items.map((item) => (
          <li key={item.path}>
            <NavLink to={item.path} className={({ isActive }) => (isActive ? 'active' : '')}>
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </aside>
  );
}
