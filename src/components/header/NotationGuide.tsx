import { BookOpenIcon } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface NotationGuideProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
}

export function NotationGuide({
  open,
  onOpenChange,
  showTrigger = true,
}: NotationGuideProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {showTrigger ? (
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" title="Notation Guide">
            <BookOpenIcon className="size-6" />
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="font-mono text-2xl">
            Combo Notation Guide
          </DialogTitle>
          <DialogDescription>
            Complete reference for all supported notation types and syntax
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="separators" className="gap-6">
          <TabsList className="w-full">
            <TabsTrigger
              value="separators"
              className="cursor-pointer data-[state=inactive]:hover:bg-background/50 data-[state=inactive]:hover:text-foreground transition-colors"
            >
              Separators
            </TabsTrigger>
            <TabsTrigger
              value="motions"
              className="cursor-pointer data-[state=inactive]:hover:bg-background/50 data-[state=inactive]:hover:text-foreground transition-colors"
            >
              Motions
            </TabsTrigger>
            <TabsTrigger
              value="modifiers"
              className="cursor-pointer data-[state=inactive]:hover:bg-background/50 data-[state=inactive]:hover:text-foreground transition-colors"
            >
              Modifiers
            </TabsTrigger>
            <TabsTrigger
              value="examples"
              className="cursor-pointer data-[state=inactive]:hover:bg-background/50 data-[state=inactive]:hover:text-foreground transition-colors"
            >
              Examples
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[calc(85vh-180px)] pr-4">
            <TabsContent value="separators" className="space-y-4">
              <div>
                <h3 className="font-mono font-semibold text-lg mb-3">
                  Separators & Flow
                </h3>
                <div>
                  <NotationRow
                    index={0}
                    notation=">"
                    meaning="Proceed from the previous move to the following move"
                  />
                  <NotationRow
                    index={1}
                    notation="|> or (Land)"
                    meaning="Indicate that the player must land at that point in the sequence"
                  />
                  <NotationRow
                    index={2}
                    notation=","
                    meaning="Link the previous move into the following move"
                  />
                  <NotationRow
                    index={3}
                    notation="~"
                    meaning="Cancel the previous special into a follow-up"
                  />
                  <NotationRow
                    index={4}
                    notation="+"
                    meaning="Press buttons simultaneously"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="motions" className="space-y-4">
              <div>
                <h3 className="font-mono font-semibold text-lg mb-3">
                  Special Motions
                </h3>
                <div>
                  <NotationRow
                    index={0}
                    notation="qcf. / 236"
                    meaning="Quarter Circle Forward"
                  />
                  <NotationRow
                    index={1}
                    notation="qcb. / 214"
                    meaning="Quarter Circle Back"
                  />
                  <NotationRow
                    index={2}
                    notation="dp. / 623"
                    meaning="Dragon Punch (Shoryuken)"
                  />
                  <NotationRow
                    index={3}
                    notation="rdp. / 421"
                    meaning="Reverse Dragon Punch"
                  />
                  <NotationRow
                    index={4}
                    notation="hcf. / 41236"
                    meaning="Half Circle Forward"
                  />
                  <NotationRow
                    index={5}
                    notation="hcb. / 63214"
                    meaning="Half Circle Back"
                  />
                  <NotationRow
                    index={6}
                    notation="2qcf. / 236236"
                    meaning="Double Quarter Circle Forward"
                  />
                  <NotationRow
                    index={7}
                    notation="2qcb. / 214214"
                    meaning="Double Quarter Circle Back"
                  />
                  <NotationRow
                    index={8}
                    notation="dd. / 22"
                    meaning="Double Down"
                  />
                  <NotationRow
                    index={9}
                    notation="dash / 66"
                    meaning="Forward Dash"
                  />
                  <NotationRow
                    index={10}
                    notation="back dash / 44"
                    meaning="Back Dash"
                  />
                </div>
              </div>

              <div>
                <h3 className="font-mono font-semibold text-lg mb-3">
                  Numpad Notation
                </h3>
                <div className="grid grid-cols-3 gap-2 max-w-xs mb-3">
                  <div className="bg-muted p-3 rounded text-center font-mono">
                    7 ↖
                  </div>
                  <div className="bg-muted p-3 rounded text-center font-mono">
                    8 ↑
                  </div>
                  <div className="bg-muted p-3 rounded text-center font-mono">
                    9 ↗
                  </div>
                  <div className="bg-muted p-3 rounded text-center font-mono">
                    4 ←
                  </div>
                  <div className="bg-muted p-3 rounded text-center font-mono">
                    5 ⊙
                  </div>
                  <div className="bg-muted p-3 rounded text-center font-mono">
                    6 →
                  </div>
                  <div className="bg-muted p-3 rounded text-center font-mono">
                    1 ↙
                  </div>
                  <div className="bg-muted p-3 rounded text-center font-mono">
                    2 ↓
                  </div>
                  <div className="bg-muted p-3 rounded text-center font-mono">
                    3 ↘
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  5 = Neutral position (no directional input)
                </p>
              </div>
            </TabsContent>

            <TabsContent value="modifiers" className="space-y-4">
              <div>
                <h3 className="font-mono font-semibold text-lg mb-3">
                  Position Modifiers
                </h3>
                <div>
                  <NotationRow
                    index={0}
                    notation="st. / standing"
                    meaning="Standing position"
                  />
                  <NotationRow
                    index={1}
                    notation="cr. / crouching"
                    meaning="Crouching position"
                  />
                  <NotationRow
                    index={2}
                    notation="j. / jumping"
                    meaning="Jumping/Aerial position"
                  />
                  <NotationRow
                    index={3}
                    notation="dj. / double jump"
                    meaning="Double Jump"
                  />
                  <NotationRow
                    index={4}
                    notation="sj. / super jump"
                    meaning="Super Jump"
                  />
                  <NotationRow
                    index={5}
                    notation="cl. / close"
                    meaning="Close distance version"
                  />
                  <NotationRow
                    index={6}
                    notation="f. / far"
                    meaning="Far distance version"
                  />
                </div>
              </div>

              <div>
                <h3 className="font-mono font-semibold text-lg mb-3">
                  Action Modifiers
                </h3>
                <div>
                  <NotationRow
                    index={0}
                    notation="jc. / jump cancel"
                    meaning="Jump Cancel"
                  />
                  <NotationRow
                    index={1}
                    notation="sjc. / super jump cancel"
                    meaning="Super Jump Cancel"
                  />
                  <NotationRow
                    index={2}
                    notation="dl. / delay"
                    meaning="Delay the following move"
                  />
                  <NotationRow
                    index={3}
                    notation="(whiff)"
                    meaning="The move must whiff (not hit)"
                  />
                  <NotationRow index={4} notation="CH" meaning="Counter Hit" />
                  <NotationRow index={5} notation="[X]" meaning="Hold input" />
                  <NotationRow
                    index={6}
                    notation="(sequence)xN"
                    meaning="Repeat sequence N amount of times"
                  />
                  <NotationRow
                    index={7}
                    notation="(N)"
                    meaning="Hit N of a move or move must deal N amount of hits"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="examples" className="space-y-4">
              <div>
                <h3 className="font-mono font-semibold text-lg mb-3">
                  Traditional Notation
                </h3>
                <div className="space-y-2">
                  <ExampleRow
                    notation="cr.L , st.M , qcf.H"
                    meaning="Crouching Light, Standing Medium, Quarter Circle Forward Heavy"
                  />
                </div>
              </div>

              <div>
                <h3 className="font-mono font-semibold text-lg mb-3">
                  Numpad Notation
                </h3>
                <div className="space-y-2">
                  <ExampleRow
                    notation="2L > 5M > 236H"
                    meaning="Crouching Light, Standing Medium, Quarter Circle Forward Heavy"
                  />
                </div>
              </div>

              <div>
                <h3 className="font-mono font-semibold text-lg mb-3">
                  Mixed Notation
                </h3>
                <div className="space-y-2">
                  <ExampleRow
                    notation="cr.L , 2M > qcf.H"
                    meaning="Mix traditional and numpad notation freely"
                  />
                </div>
              </div>

              <div>
                <h3 className="font-mono font-semibold text-lg mb-3">
                  Advanced Examples
                </h3>
                <div className="space-y-2">
                  <ExampleRow
                    notation="CH st.H , dash , st.M xx qcf.H"
                    meaning="Counter Hit Standing Heavy, dash, Standing Medium, special cancel Quarter Circle Forward Heavy"
                  />
                  <ExampleRow
                    notation="(5L > 2L)x3 > 5M > 623H"
                    meaning="Repeat Light sequence 3 times, standing Medium into DP Heavy"
                  />
                  <ExampleRow
                    notation="j.LLL > dj.MM |> 2M > 236L+M"
                    meaning="Light Air combo with double jump Medium combo, land, then super"
                  />
                </div>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function NotationRow({
  notation,
  meaning,
  index,
}: {
  notation: string;
  meaning: string;
  index: number;
}) {
  return (
    <div
      className={`flex gap-4 p-2 rounded ${index % 2 === 0 ? 'bg-muted/30' : ''}`}
    >
      <code className="font-mono font-semibold text-primary min-w-[140px] shrink-0">
        {notation}
      </code>
      <span className="text-sm text-muted-foreground">{meaning}</span>
    </div>
  );
}

function ExampleRow({
  notation,
  meaning,
}: {
  notation: string;
  meaning: string;
}) {
  return (
    <div className="border border-border rounded-lg p-3 space-y-1">
      <code className="font-mono text-primary block">{notation}</code>
      <p className="text-sm text-muted-foreground">{meaning}</p>
    </div>
  );
}
