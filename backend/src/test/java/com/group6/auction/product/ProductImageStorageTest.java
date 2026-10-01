package com.group6.auction.product;
import com.group6.auction.product.service.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;
import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.*;
import java.nio.file.*;
import static org.assertj.core.api.Assertions.*;
class ProductImageStorageTest {
 @TempDir Path root;
 byte[] png() throws Exception {var out=new ByteArrayOutputStream();ImageIO.write(new BufferedImage(2,3,BufferedImage.TYPE_INT_RGB),"png",out);return out.toByteArray();}
 @Test void publishSurvivesNewStorageInstanceAndRejectsUnknownPaths() throws Exception {
  var storage=new ProductImageStorage(root.toString());
  var staged=storage.stage(new MockMultipartFile("image","../name.png","text/html",png()));
  String url=storage.publish(staged);storage.discard(staged);
  assertThat(new ProductImageStorage(root.toString()).read(url.substring(url.lastIndexOf('/')+1)).exists()).isTrue();
  for(String name:new String[]{"../secret","a.svg","00000000-0000-0000-0000-000000000000.png"})assertThatThrownBy(()->storage.read(name)).isInstanceOf(ProductException.class);
  storage.rollbackPublished(staged);assertThat(Files.list(root).count()).isZero();
 }
 @Test void rejectsEmptyLargeMalformedAndExcessivePixels() throws Exception {
  var storage=new ProductImageStorage(root.toString());
  assertThat(storage.stage(null)).isNull();storage.discard((ProductImageStorage.Staged)null);storage.rollbackPublished(null);
  for(byte[] bytes:new byte[][]{new byte[0],new byte[5*1024*1024+1],"<svg/>".getBytes()})assertThatThrownBy(()->storage.stage(new MockMultipartFile("image","x.png","image/png",bytes))).isInstanceOf(ProductException.class);
  byte[] bytes=png();java.nio.ByteBuffer.wrap(bytes,16,8).putInt(100000).putInt(100000);
  assertThatThrownBy(()->storage.stage(new MockMultipartFile("image","x.png","image/png",bytes))).isInstanceOf(ProductException.class);
  try(var files=Files.list(root)){assertThat(files.count()).isZero();}
 }
 @Test void storageFailureDoesNotPublish() throws Exception {
  Path file=Files.writeString(root.resolve("file"),"occupied");
  assertThatThrownBy(()->new ProductImageStorage(file.toString()).stage(new MockMultipartFile("image","x.png","image/png",png()))).isInstanceOf(ProductException.class);
  var storage=new ProductImageStorage(root.toString());
  var staged=storage.stage(new MockMultipartFile("image","x.png","image/png",png()));storage.discard(staged);
  assertThatThrownBy(()->storage.publish(staged)).isInstanceOf(ProductException.class);
 }
}
