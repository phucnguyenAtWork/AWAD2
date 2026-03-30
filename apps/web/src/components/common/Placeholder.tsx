import { Card } from './Card';

export const Placeholder = ({ title }: { title: string }) => (
  <Card>
    <p className="text-sm text-gray-600">{title}</p>
  </Card>
);
