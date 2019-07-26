exports.onRouteUpdate = ({ location }) => {
  // Target highlighting. The :target CSS pseudo selector is not applied
  // when the url changes through location.pushState, so we need to
  // apply the styles manually.
  const previousTarget = document.querySelector(".target");
  if (previousTarget) {
    previousTarget.classList.remove("target");
  }
  if (location.hash.length > 1) {
    const newTarget = document.getElementById(location.hash.substring(1));
    if (newTarget) {
      newTarget.classList.add("target");
    }
  }

  // Fluid images: replace in-page previews with the actual resources.
  const previews = document.querySelectorAll(`.fluid.preview`);

  for (let i = 0; i < previews.length; i++) {
    const preview = previews[i];

    const backgroundElement = preview;
    let imageElement = preview.nextElementSibling;
    if (!imageElement) {
      continue;
    }

    const onImageLoad = () => {
      backgroundElement.style.transition = `opacity 0.5s 0.5s`;
      imageElement.style.transition = `opacity 0.5s`;
      onImageComplete()
    };

    const onImageComplete = () => {
      backgroundElement.style.opacity = 0;
      imageElement.style.opacity = 1;
      imageElement.style.color = `inherit`;
      imageElement.removeEventListener(`load`, onImageLoad);
      imageElement.removeEventListener(`error`, onImageComplete);
    };

    imageElement.style.opacity = 0;
    imageElement.addEventListener(`load`, onImageLoad);
    imageElement.addEventListener(`error`, onImageComplete);
    if (imageElement.complete) {
      onImageComplete()
    }
  }
};