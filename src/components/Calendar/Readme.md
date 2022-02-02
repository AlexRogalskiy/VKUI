Компонент выбора даты.

```jsx { "props": { "layout": false, "iframe": false } }
import * as locales from "date-fns/locale";
import { format } from "date-fns";

const Example = () => {
  const [value, setValue] = useState(new Date());
  const [enableTime, setEnableTime] = useState(false);
  const [disablePast, setDisablePast] = useState(false);
  const [disableFuture, setDisableFuture] = useState(false);
  const [locale, setLocale] = useState("ru");

  return (
    <View activePanel="calendar">
      <Panel id="calendar">
        <PanelHeader>Calendar</PanelHeader>
        <Group>
          <FormLayout>
            <FormLayoutGroup mode="vertical">
              <FormItem top="Выбранная дата">
                {format(value, "yyyy-MM-dd HH:mm:ss")}
              </FormItem>
              <FormItem top="Выбор времени">
                <Checkbox
                  checked={enableTime}
                  onChange={(e) => setEnableTime(e.target.checked)}
                >
                  Включено
                </Checkbox>
              </FormItem>
              <FormItem top="Запрет выбора прошлых дат">
                <Checkbox
                  checked={disablePast}
                  onChange={(e) => setDisablePast(e.target.checked)}
                >
                  Включено
                </Checkbox>
              </FormItem>
              <FormItem top="Запрет выбора будущих дат">
                <Checkbox
                  checked={disableFuture}
                  onChange={(e) => setDisableFuture(e.target.checked)}
                >
                  Включено
                </Checkbox>
              </FormItem>
              <FormItem top="Локаль">
                <Select
                  value={locale}
                  onChange={(e) => setLocale(e.target.value)}
                  options={[
                    {
                      label: "ru",
                      value: "ru",
                    },
                    {
                      label: "en-US",
                      value: "enUS",
                    },
                    {
                      label: "ar",
                      value: "ar",
                    },
                    {
                      label: "fr",
                      value: "fr",
                    },
                  ]}
                />
              </FormItem>
              <FormItem>
                <Calendar
                  value={value}
                  onChange={setValue}
                  enableTime={enableTime}
                  disablePast={disablePast}
                  disableFuture={disableFuture}
                  locale={locales[locale]}
                />
              </FormItem>
            </FormLayoutGroup>
          </FormLayout>
        </Group>
      </Panel>
    </View>
  );
};

<Example />;
```