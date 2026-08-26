import { Screen, type ScreenProps } from '@/app/Screen';

type Props = Omit<ScreenProps, 'showTutorialHelp'>;

/** Reading the embedded corpus never needs to fall back to a tutorial chapter. */
export function KnowledgeScreenFrame(props: Props) {
  return <Screen {...props} showTutorialHelp={false} />;
}
