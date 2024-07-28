import PopupElement from '.';
import confirmationPopup from '../confirmationPopup';
import MediaEditor from '../mediaEditor';

export default class PopupMediaEditor extends PopupElement {
  constructor(params: {
    file: File,
    width: number,
    height: number,
    onSave: (file: File) => void,
  }
  ) {
    super(
      'popup-media-editor',
      {
        overlayClosable: true,
        closable: false,
        isConfirmationNeededOnClose: () => confirmationPopup({
          titleLangKey: 'MediaEditor.DiscardQuestion',
          descriptionLangKey: 'MediaEditor.DiscardQuestionText',
          button: {
            langKey: 'Discard',
            isDanger: true
          }
        }),
        body: true
      }
    );

    const onClose = () => {
      this.hide();
    }

    const onSave = (file: File) => {
      params.onSave(file);
      this.forceHide();
    }

    this.body.append(MediaEditor({
      file: params.file,
      width: params.width,
      height: params.height,
      onClose,
      onSave
    }) as Node)
  }
}
